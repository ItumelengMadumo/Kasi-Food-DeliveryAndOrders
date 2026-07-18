import * as path from 'path';
import { Construct } from 'constructs';
import {
    Stack,
    StackProps,
    RemovalPolicy,
    Duration,
    CfnOutput,
    Expiration,
    SecretValue,
} from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export interface KasiStackProps extends StackProps {
    stage: string;
    /** Public URL customers land on after a gateway redirect, e.g. the Amplify Hosting domain. */
    frontendUrl: string;
}

/**
 * Single-stack deployment for the Kasi Food Delivery soft-launch.
 *
 * Resources:
 *   - DynamoDB single table (KasiMainTable) + 3 GSIs
 *   - Cognito User Pool + Client + groups (VENDOR, ADMIN)
 *   - PostConfirmation Lambda (auto-creates Vendor record on first sign-up)
 *   - createOrder + updateOrderStatus Lambdas
 *   - AppSync GraphQL API with mixed direct-DDB + Lambda resolvers
 *
 * Auth model (soft-launch):
 *   - Default auth: API_KEY (so unauthenticated guests can browse vendors/menus)
 *   - Additional: USER_POOLS (vendor + admin actions), IAM (seed scripts)
 *   TODO: tighten with @aws_cognito_user_pools directives on vendor mutations
 *         before opening up to real customers.
 */
export class KasiStack extends Stack {
    constructor(scope: Construct, id: string, props: KasiStackProps) {
        super(scope, id, props);

        const { stage, frontendUrl } = props;

        // ─────────────────────────────────────────────────────────────
        // DynamoDB
        // ─────────────────────────────────────────────────────────────
        const table = new dynamodb.Table(this, 'KasiMainTable', {
            tableName: `KasiMainTable-${stage}`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'expiresAt',
            removalPolicy:
                stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            pointInTimeRecovery: stage === 'prod',
        });

        table.addGlobalSecondaryIndex({
            indexName: 'GSI1-VendorOrders',
            partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        table.addGlobalSecondaryIndex({
            indexName: 'GSI2-CustomerOrders',
            partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        table.addGlobalSecondaryIndex({
            indexName: 'GSI3-VendorByWhatsApp',
            partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
            projectionType: dynamodb.ProjectionType.ALL,
        });

        // ─────────────────────────────────────────────────────────────
        // Lambdas
        // ─────────────────────────────────────────────────────────────
        const lambdaSrcRoot = path.join(__dirname, '..', '..', 'lambda');
        // infra/lambda is a sibling of infra/cdk, not nested under it — esbuild's
        // default projectRoot inference requires every `entry` to live under
        // projectRoot, so it must be pinned to infra/ (the common ancestor).
        const lambdaProjectRoot = path.join(__dirname, '..', '..');

        // Post-confirmation Cognito trigger — auto-creates Vendor record for
        // VENDOR-role sign-ups so the first dashboard load finds a real record.
        const postConfirmationFn = new NodejsFunction(this, 'PostConfirmationFn', {
            functionName: `kasi-post-confirmation-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'postConfirmation', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(10),
            environment: {
                TABLE_NAME: table.tableName,
            },
            bundling: {
                target: 'node20',
                externalModules: ['@aws-sdk/*'],
            },
        });
        table.grantWriteData(postConfirmationFn);
        postConfirmationFn.addToRolePolicy(
            new iam.PolicyStatement({
                actions: ['cognito-idp:AdminAddUserToGroup'],
                resources: ['*'], // narrowed below via UserPool ARN once it exists; see grant after pool creation
            })
        );

        const createOrderFn = new NodejsFunction(this, 'CreateOrderFn', {
            functionName: `kasi-create-order-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'createOrder', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                PLATFORM_COMMISSION_RATE: '0.10',
                ADMIN_FEE_NON_BANKED: '5.00',
                // NOTIFICATION_LAMBDA_ARN intentionally unset — WhatsApp out-of-scope for soft-launch
            },
            bundling: {
                target: 'node20',
                externalModules: ['@aws-sdk/*'],
            },
        });
        table.grantReadWriteData(createOrderFn);

        const updateOrderStatusFn = new NodejsFunction(this, 'UpdateOrderStatusFn', {
            functionName: `kasi-update-order-status-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'updateOrderStatus', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(10),
            environment: {
                TABLE_NAME: table.tableName,
            },
            bundling: {
                target: 'node20',
                externalModules: ['@aws-sdk/*'],
            },
        });
        table.grantReadWriteData(updateOrderStatusFn);

        // Converts a pending VendorApplication into a live, login-free Vendor
        // record (vendorId is a fresh UUID, independent of any Cognito user) —
        // the core of the operator-driven onboarding flow.
        const approveVendorFn = new NodejsFunction(this, 'ApproveVendorFn', {
            functionName: `kasi-approve-vendor-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'approveVendor', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(10),
            environment: {
                TABLE_NAME: table.tableName,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadWriteData(approveVendorFn);

        // ─────────────────────────────────────────────────────────────
        // Payments — PayFast + Ozow
        // ─────────────────────────────────────────────────────────────
        //
        // Seeded with PayFast's publicly-documented sandbox merchant so the
        // full pay -> webhook -> order-paid loop is testable immediately.
        // Ozow has no universal public sandbox, so its fields start blank —
        // fill them in via the Secrets Manager console once you have a
        // (free) Ozow test/live merchant account.
        const paymentsSecret = new secretsmanager.Secret(this, 'PaymentsSecret', {
            secretName: `kasi-payments-${stage}`,
            description: 'PayFast + Ozow merchant credentials',
            removalPolicy:
                stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            secretObjectValue: {
                payfastMode: SecretValue.unsafePlainText('sandbox'),
                payfastMerchantId: SecretValue.unsafePlainText('10000100'),
                payfastMerchantKey: SecretValue.unsafePlainText('46f0cd694581a'),
                payfastPassphrase: SecretValue.unsafePlainText(''),
                ozowMode: SecretValue.unsafePlainText('staging'),
                ozowSiteCode: SecretValue.unsafePlainText(''),
                ozowPrivateKey: SecretValue.unsafePlainText(''),
                ozowApiKey: SecretValue.unsafePlainText(''),
            },
        });

        const payfastWebhookFn = new NodejsFunction(this, 'PayfastWebhookFn', {
            functionName: `kasi-payfast-webhook-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'payfastWebhook', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                PAYMENTS_SECRET_ARN: paymentsSecret.secretArn,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadWriteData(payfastWebhookFn);
        paymentsSecret.grantRead(payfastWebhookFn);

        const ozowWebhookFn = new NodejsFunction(this, 'OzowWebhookFn', {
            functionName: `kasi-ozow-webhook-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'ozowWebhook', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                PAYMENTS_SECRET_ARN: paymentsSecret.secretArn,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadWriteData(ozowWebhookFn);
        paymentsSecret.grantRead(ozowWebhookFn);

        // Public HTTP API for gateway server-to-server webhooks (PayFast ITN,
        // Ozow notify). These are called by the gateways directly, never by
        // browser JS, so no CORS configuration is needed.
        const webhookApi = new apigwv2.HttpApi(this, 'PaymentWebhookApi', {
            apiName: `kasi-payment-webhooks-${stage}`,
        });
        webhookApi.addRoutes({
            path: '/webhooks/payfast/itn',
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2Integrations.HttpLambdaIntegration(
                'PayfastItnIntegration',
                payfastWebhookFn
            ),
        });
        webhookApi.addRoutes({
            path: '/webhooks/ozow/notify',
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2Integrations.HttpLambdaIntegration(
                'OzowNotifyIntegration',
                ozowWebhookFn
            ),
        });

        const initiatePaymentFn = new NodejsFunction(this, 'InitiatePaymentFn', {
            functionName: `kasi-initiate-payment-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'initiatePayment', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                PAYMENTS_SECRET_ARN: paymentsSecret.secretArn,
                FRONTEND_URL: frontendUrl,
                WEBHOOK_BASE_URL: webhookApi.apiEndpoint,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadWriteData(initiatePaymentFn);
        paymentsSecret.grantRead(initiatePaymentFn);

        // ─────────────────────────────────────────────────────────────
        // WhatsApp ordering channel (Twilio)
        // ─────────────────────────────────────────────────────────────
        //
        // Seeded blank — fill in via Secrets Manager (accountSid, authToken,
        // whatsappFrom, voiceNumber — all in E.164 format) once real Twilio
        // credentials are on hand. A leaked Twilio auth token is a direct
        // cost/abuse vector, so this mirrors the payments-secret pattern
        // rather than plain env vars. voiceNumber is a separate Voice-capable
        // number from whatsappFrom — WhatsApp Business API senders aren't
        // voice-capable — used as the masked caller ID for bridge calls.
        const whatsappSecret = new secretsmanager.Secret(this, 'WhatsAppSecret', {
            secretName: `kasi-whatsapp-${stage}`,
            description: 'Twilio WhatsApp + Voice credentials',
            removalPolicy:
                stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            secretObjectValue: {
                accountSid: SecretValue.unsafePlainText(''),
                authToken: SecretValue.unsafePlainText(''),
                whatsappFrom: SecretValue.unsafePlainText(''),
                voiceNumber: SecretValue.unsafePlainText(''),
            },
        });

        const sendWhatsAppNotificationFn = new NodejsFunction(this, 'SendWhatsAppNotificationFn', {
            functionName: `kasi-send-whatsapp-notification-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'sendWhatsAppNotification', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadData(sendWhatsAppNotificationFn);
        whatsappSecret.grantRead(sendWhatsAppNotificationFn);

        // Notify the vendor by WhatsApp for web-originated orders too, not
        // just the ones created inside the WhatsApp chat flow.
        createOrderFn.addEnvironment('NOTIFICATION_LAMBDA_ARN', sendWhatsAppNotificationFn.functionArn);
        sendWhatsAppNotificationFn.grantInvoke(createOrderFn);

        const whatsappWebhookFn = new NodejsFunction(this, 'WhatsAppWebhookFn', {
            functionName: `kasi-whatsapp-webhook-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'whatsappWebhook', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
                WEBHOOK_URL: `${webhookApi.apiEndpoint}/webhooks/whatsapp`,
                NOTIFICATION_LAMBDA_ARN: sendWhatsAppNotificationFn.functionArn,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadWriteData(whatsappWebhookFn);
        whatsappSecret.grantRead(whatsappWebhookFn);
        sendWhatsAppNotificationFn.grantInvoke(whatsappWebhookFn);

        webhookApi.addRoutes({
            path: '/webhooks/whatsapp',
            methods: [apigwv2.HttpMethod.POST],
            integration: new apigwv2Integrations.HttpLambdaIntegration(
                'WhatsAppWebhookIntegration',
                whatsappWebhookFn
            ),
        });

        // Masked-caller-ID bridge calling — customer taps Call, Twilio rings
        // them, then bridges to the vendor's real number using our own Voice
        // number as caller ID. No inbound webhook needed (see Lambda docstring).
        const initiateVoiceCallFn = new NodejsFunction(this, 'InitiateVoiceCallFn', {
            functionName: `kasi-initiate-voice-call-${stage}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            entry: path.join(lambdaSrcRoot, 'initiateVoiceCall', 'index.js'),
            projectRoot: lambdaProjectRoot,
            handler: 'handler',
            timeout: Duration.seconds(15),
            environment: {
                TABLE_NAME: table.tableName,
                WHATSAPP_SECRET_ARN: whatsappSecret.secretArn,
            },
            bundling: { target: 'node20', externalModules: ['@aws-sdk/*'] },
        });
        table.grantReadData(initiateVoiceCallFn);
        whatsappSecret.grantRead(initiateVoiceCallFn);

        // ─────────────────────────────────────────────────────────────
        // Cognito
        // ─────────────────────────────────────────────────────────────
        const userPool = new cognito.UserPool(this, 'KasiUserPool', {
            userPoolName: `kasi-users-${stage}`,
            selfSignUpEnabled: true,
            signInAliases: { phone: true, email: true, username: true },
            autoVerify: { email: true },
            standardAttributes: {
                phoneNumber: { required: true, mutable: true },
                email: { required: false, mutable: true },
                fullname: { required: false, mutable: true },
            },
            customAttributes: {
                role: new cognito.StringAttribute({ mutable: true }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireDigits: true,
                requireSymbols: false,
                requireUppercase: false,
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            lambdaTriggers: {
                postConfirmation: postConfirmationFn,
            },
            removalPolicy:
                stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        new cognito.CfnUserPoolGroup(this, 'VendorGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'VENDOR',
            description: 'Approved vendors who can manage menus and orders',
        });

        new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'ADMIN',
            description: 'Platform admins',
        });

        new cognito.CfnUserPoolGroup(this, 'SuperAdminGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'SUPER_ADMIN',
            description: 'Full-access platform super administrators',
        });

        new cognito.CfnUserPoolGroup(this, 'DevGroup', {
            userPoolId: userPool.userPoolId,
            groupName: 'DEV',
            description: 'Engineering and development users',
        });

        const userPoolClient = new cognito.UserPoolClient(this, 'KasiWebClient', {
            userPool,
            userPoolClientName: `kasi-web-${stage}`,
            authFlows: {
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false,
            preventUserExistenceErrors: true,
        });

        // ─────────────────────────────────────────────────────────────
        // AppSync
        // ─────────────────────────────────────────────────────────────
        const schemaPath = path.join(__dirname, '..', '..', 'appsync', 'schema.graphql');
        const resolversDir = path.join(__dirname, '..', '..', 'appsync', 'resolvers');

        const api = new appsync.GraphqlApi(this, 'KasiApi', {
            name: `kasi-api-${stage}`,
            definition: appsync.Definition.fromFile(schemaPath),
            authorizationConfig: {
                defaultAuthorization: {
                    authorizationType: appsync.AuthorizationType.API_KEY,
                    apiKeyConfig: {
                        name: `kasi-public-${stage}`,
                        description: 'Public read access for guest browsing',
                        expires: Expiration.after(Duration.days(365)),
                    },
                },
                additionalAuthorizationModes: [
                    {
                        authorizationType: appsync.AuthorizationType.USER_POOL,
                        userPoolConfig: { userPool },
                    },
                    { authorizationType: appsync.AuthorizationType.IAM },
                ],
            },
            logConfig: {
                fieldLogLevel: appsync.FieldLogLevel.ERROR,
            },
            xrayEnabled: false,
        });

        // Data sources
        const ddbSource = api.addDynamoDbDataSource('KasiTableSource', table);
        const createOrderSource = api.addLambdaDataSource(
            'CreateOrderSource',
            createOrderFn
        );
        const updateOrderStatusSource = api.addLambdaDataSource(
            'UpdateOrderStatusSource',
            updateOrderStatusFn
        );
        const initiatePaymentSource = api.addLambdaDataSource(
            'InitiatePaymentSource',
            initiatePaymentFn
        );
        const approveVendorSource = api.addLambdaDataSource(
            'ApproveVendorSource',
            approveVendorFn
        );
        const initiateVoiceCallSource = api.addLambdaDataSource(
            'InitiateVoiceCallSource',
            initiateVoiceCallFn
        );
        const noneSource = api.addNoneDataSource('NoneSource');

        // Helper: attach a JS resolver from an existing file in /infra/appsync/resolvers
        const jsResolver = (
            typeName: string,
            fieldName: string,
            file: string,
            dataSource: appsync.BaseDataSource
        ) => {
            new appsync.Resolver(this, `Res-${typeName}-${fieldName}`, {
                api,
                typeName,
                fieldName,
                dataSource,
                runtime: appsync.FunctionRuntime.JS_1_0_0,
                code: appsync.Code.fromAsset(path.join(resolversDir, file)),
            });
        };

        // ── Direct DDB resolvers (existing files) ────────────────────
        jsResolver('Query', 'getVendor', 'Query.getVendor.js', ddbSource);
        jsResolver('Query', 'getVendorMenu', 'Query.getVendorMenu.js', ddbSource);
        jsResolver(
            'Query',
            'getVendorByWhatsApp',
            'Query.getVendorByWhatsApp.js',
            ddbSource
        );
        jsResolver('Query', 'getVendorOrders', 'Query.getVendorOrders.js', ddbSource);

        jsResolver('Mutation', 'createMenuItem', 'Mutation.createMenuItem.js', ddbSource);
        jsResolver('Mutation', 'updateMenuItem', 'Mutation.updateMenuItem.js', ddbSource);
        jsResolver('Mutation', 'deleteMenuItem', 'Mutation.deleteMenuItem.js', ddbSource);
        jsResolver(
            'Mutation',
            'toggleMenuItemAvailability',
            'Mutation.toggleMenuItemAvailability.js',
            ddbSource
        );
        jsResolver('Mutation', 'markOrderPaid', 'Mutation.markOrderPaid.js', ddbSource);

        // ── Direct DDB resolvers (new files added for soft-launch) ───
        jsResolver('Query', 'getOrder', 'Query.getOrder.js', ddbSource);
        jsResolver('Query', 'getCustomerOrders', 'Query.getCustomerOrders.js', ddbSource);
        jsResolver('Query', 'getAllVendors', 'Query.getAllVendors.js', ddbSource);
        jsResolver('Query', 'getAllOrders', 'Query.getAllOrders.js', ddbSource);
        jsResolver('Query', 'getNearbyVendors', 'Query.getNearbyVendors.js', ddbSource);
        jsResolver('Query', 'getVendorReviews', 'Query.getVendorReviews.js', ddbSource);
        jsResolver('Query', 'getOrderPaymentProofs', 'Query.getOrderPaymentProofs.js', ddbSource);
        jsResolver('Query', 'getVendorRevenue', 'Query.getVendorRevenue.js', ddbSource);
        jsResolver('Query', 'getVendorInventory', 'Query.getVendorInventory.js', ddbSource);
        jsResolver(
            'Query',
            'getPendingVendorApplications',
            'Query.getPendingVendorApplications.js',
            ddbSource
        );
        jsResolver('Query', 'getUser', 'Query.getUser.js', ddbSource);
        jsResolver(
            'Query',
            'getVendorBankDetails',
            'Query.getVendorBankDetails.js',
            ddbSource
        );

        jsResolver(
            'Mutation',
            'updateVendorProfile',
            'Mutation.updateVendorProfile.js',
            ddbSource
        );
        jsResolver(
            'Mutation',
            'updateVendorBankDetails',
            'Mutation.updateVendorBankDetails.js',
            ddbSource
        );
        jsResolver('Mutation', 'cancelOrder', 'Mutation.cancelOrder.js', ddbSource);
        jsResolver('Mutation', 'createReview', 'Mutation.createReview.js', ddbSource);
        jsResolver(
            'Mutation',
            'saveWhatsAppPaymentProof',
            'Mutation.saveWhatsAppPaymentProof.js',
            ddbSource
        );
        jsResolver('Mutation', 'recordRevenue', 'Mutation.recordRevenue.js', ddbSource);
        jsResolver('Mutation', 'upsertInventoryItem', 'Mutation.upsertInventoryItem.js', ddbSource);
        jsResolver(
            'Mutation',
            'createVendorApplication',
            'Mutation.createVendorApplication.js',
            ddbSource
        );
        jsResolver('Mutation', 'rejectVendor', 'Mutation.rejectVendor.js', ddbSource);

        // ── Field resolvers for Order.items and Order.vendor ─────────
        jsResolver('Order', 'items', 'Order.items.js', ddbSource);
        jsResolver('Order', 'vendor', 'Order.vendor.js', ddbSource);

        // ── No-op resolvers for currentUser/guestCheckout (return identity) ─
        jsResolver('Query', 'getCurrentUser', 'Query.getCurrentUser.js', noneSource);
        jsResolver('Mutation', 'guestCheckout', 'Mutation.guestCheckout.js', noneSource);
        jsResolver('Mutation', 'registerUser', 'Mutation.registerUser.js', noneSource);

        // ── Lambda-backed resolvers ──────────────────────────────────
        new appsync.Resolver(this, 'Res-Mutation-createOrder', {
            api,
            typeName: 'Mutation',
            fieldName: 'createOrder',
            dataSource: createOrderSource,
        });

        new appsync.Resolver(this, 'Res-Mutation-updateOrderStatus', {
            api,
            typeName: 'Mutation',
            fieldName: 'updateOrderStatus',
            dataSource: updateOrderStatusSource,
        });

        new appsync.Resolver(this, 'Res-Mutation-initiatePayment', {
            api,
            typeName: 'Mutation',
            fieldName: 'initiatePayment',
            dataSource: initiatePaymentSource,
        });

        new appsync.Resolver(this, 'Res-Mutation-approveVendor', {
            api,
            typeName: 'Mutation',
            fieldName: 'approveVendor',
            dataSource: approveVendorSource,
        });

        new appsync.Resolver(this, 'Res-Mutation-initiateVoiceCall', {
            api,
            typeName: 'Mutation',
            fieldName: 'initiateVoiceCall',
            dataSource: initiateVoiceCallSource,
        });

        // ─────────────────────────────────────────────────────────────
        // Outputs — copy these into frontend/.env.local
        // ─────────────────────────────────────────────────────────────
        new CfnOutput(this, 'Region', { value: this.region });
        new CfnOutput(this, 'TableName', { value: table.tableName });
        new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
        new CfnOutput(this, 'UserPoolClientId', {
            value: userPoolClient.userPoolClientId,
        });
        new CfnOutput(this, 'AppSyncEndpoint', { value: api.graphqlUrl });
        new CfnOutput(this, 'AppSyncApiKey', { value: api.apiKey ?? '' });
        new CfnOutput(this, 'AppSyncApiId', { value: api.apiId });
        new CfnOutput(this, 'WebhookApiUrl', { value: webhookApi.apiEndpoint });
        new CfnOutput(this, 'PaymentsSecretArn', { value: paymentsSecret.secretArn });
        new CfnOutput(this, 'WhatsAppSecretArn', { value: whatsappSecret.secretArn });

    }
}

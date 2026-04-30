import {
    confirmSignUp,
    fetchAuthSession,
    fetchUserAttributes,
    getCurrentUser,
    resendSignUpCode,
    signIn,
    signOut,
    signUp,
} from 'aws-amplify/auth';
import type { Role, User } from '../types';

const VALID_ROLES: Role[] = ['CUSTOMER', 'VENDOR', 'ADMIN'];

function normalizeRole(value: unknown): Role | null {
    if (typeof value !== 'string') return null;
    const normalized = value.toUpperCase();
    return VALID_ROLES.includes(normalized as Role) ? (normalized as Role) : null;
}

export function normalizePhoneNumber(phone: string) {
    const compact = phone.replace(/\s+/g, '');
    if (!/^\+\d{8,15}$/.test(compact)) {
        throw new Error('Use international phone format, for example +27712345678.');
    }
    return compact;
}

function getRoleFromSession(payload: Record<string, unknown> | undefined) {
    const directRole = normalizeRole(payload?.['custom:role']);
    if (directRole) return directRole;

    const groups = payload?.['cognito:groups'];
    if (Array.isArray(groups)) {
        for (const group of groups) {
            const role = normalizeRole(group);
            if (role) return role;
        }
    }

    return null;
}

export async function loadAuthenticatedUser(): Promise<User | null> {
    try {
        const currentUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        const session = await fetchAuthSession();

        const accessPayload = session.tokens?.accessToken?.payload as Record<string, unknown> | undefined;
        const idPayload = session.tokens?.idToken?.payload as Record<string, unknown> | undefined;

        const role =
            normalizeRole(attributes['custom:role']) ||
            getRoleFromSession(accessPayload) ||
            getRoleFromSession(idPayload) ||
            normalizeRole(import.meta.env.VITE_DEFAULT_SIGNIN_ROLE) ||
            'VENDOR';

        const phone = attributes.phone_number || currentUser.signInDetails?.loginId || currentUser.username;
        const displayName =
            attributes.name ||
            [attributes.given_name, attributes.family_name].filter(Boolean).join(' ').trim() ||
            attributes.email ||
            phone;

        return {
            id: currentUser.userId,
            name: displayName,
            phone,
            email: attributes.email,
            role,
            isGuest: false,
            createdAt: new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

export async function registerWithCognito(input: {
    name: string;
    phone: string;
    email?: string;
    password: string;
}) {
    const username = normalizePhoneNumber(input.phone);

    return signUp({
        username,
        password: input.password,
        options: {
            userAttributes: {
                name: input.name.trim(),
                phone_number: username,
                ...(input.email?.trim() ? { email: input.email.trim() } : {}),
            },
        },
    });
}

export async function confirmRegistration(phone: string, confirmationCode: string) {
    return confirmSignUp({
        username: normalizePhoneNumber(phone),
        confirmationCode: confirmationCode.trim(),
    });
}

export async function resendRegistrationCode(phone: string) {
    return resendSignUpCode({ username: normalizePhoneNumber(phone) });
}

export async function signInWithCognito(phone: string, password: string) {
    const result = await signIn({
        username: normalizePhoneNumber(phone),
        password,
    });

    if (result.nextStep.signInStep !== 'DONE') {
        if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
            throw new Error('Your account is not confirmed yet. Enter the verification code to continue.');
        }

        throw new Error(`Sign-in step not completed: ${result.nextStep.signInStep}`);
    }

    const user = await loadAuthenticatedUser();
    if (!user) {
        throw new Error('Signed in, but the user profile could not be loaded.');
    }

    return user;
}

export async function signOutFromCognito() {
    await signOut();
}
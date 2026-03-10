import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AuthUser, Profile, Tenant, ProfileType } from '../types';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface AuthContextType {
    user: AuthUser | null;
    profile: Profile | null;
    tenant: Tenant | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string, profile?: Profile }>;
    signUp: (data: SignUpData) => Promise<{ error?: string, profile?: Profile }>;
    signUpFromLead: (data: LeadSignUpData) => Promise<{ error?: string, profile?: Profile }>;
    signOut: () => Promise<void>;
    refreshAuthData: () => Promise<void>;
    setDemoProfile: (profileType: ProfileType) => void;
}

interface SignUpData {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    profileType: ProfileType;
    inviteCode?: string;
    tenantName?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export interface LeadSignUpData {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    profileType: ProfileType;
}

// Demo data for when Supabase is not configured
const DEMO_TENANT: Tenant = {
    id: 'demo-tenant-001',
    name: 'Condomínio Residencial Parque das Flores',
    slug: 'parque-das-flores',
    admin_user_id: 'demo-user-001',
    token_balance: 487_350,
    plan: 'pro',
    plan_tokens_total: 2_000_000,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

const createDemoProfile = (type: ProfileType): Profile => ({
    id: `demo-profile-${type}`,
    user_id: `demo-user-${type}`,
    tenant_id: DEMO_TENANT.id,
    full_name: type === 'superadmin' ? 'Dono da Plataforma' : type === 'admin' ? 'Carlos Silva' : type === 'morador' ? 'Ana Oliveira' : type === 'zelador' ? 'José Santos' : 'Roberto Lima',
    phone: '(11) 99999-9999',
    profile_type: type,
    is_active: true,
    daily_token_usage: Math.floor(Math.random() * 5000),
    last_usage_reset: new Date().toISOString(),
    created_at: new Date().toISOString(),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const loadProfile = useCallback(async (userId: string) => {
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (profileError || !profileData) {
            // Stale session or missing profile — force sign out
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
            setTenant(null);
            return;
        }

        setProfile(profileData as Profile);

        if (profileData.tenant_id) {
            const { data: tenantData } = await supabase
                .from('tenants')
                .select('*')
                .eq('id', profileData.tenant_id)
                .single();

            if (tenantData) {
                setTenant(tenantData as Tenant);
            }
        } else {
            setTenant(null);
        }
    }, []);

    useEffect(() => {
        if (!isSupabaseConfigured()) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsLoading(false);
            return;
        }

        // Check existing session
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                setUser({ id: session.user.id, email: session.user.email || '' });
                loadProfile(session.user.id);
            }
            setIsLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setUser({ id: session.user.id, email: session.user.email || '' });
                loadProfile(session.user.id);
            } else {
                setUser(null);
                setProfile(null);
                setTenant(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [loadProfile]);



    const signIn = useCallback(async (email: string, password: string) => {
        if (!isSupabaseConfigured()) {
            // Demo sign in
            const demoProfile = createDemoProfile('admin');
            setUser({ id: 'demo-user-admin', email });
            setProfile(demoProfile);
            setTenant(DEMO_TENANT);
            return { profile: demoProfile };
        }

        const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };

        if (authData.user) {
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', authData.user.id)
                .maybeSingle();

            return { profile: profileData as Profile };
        }

        return {};
    }, []);

    const signUp = useCallback(async (data: SignUpData) => {
        if (!isSupabaseConfigured()) {
            setUser({ id: `demo-user-${data.profileType}`, email: data.email });
            setProfile(createDemoProfile(data.profileType));
            setTenant(DEMO_TENANT);
            return {};
        }

        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    full_name: data.fullName,
                    phone: data.phone,
                    profile_type: data.profileType,
                    tenant_name: data.tenantName,
                    invite_code: data.inviteCode,
                }
            }
        });

        if (error) return { error: error.message };
        if (!authData.user) return { error: 'Erro ao criar conta' };

        // Profile is automatically created by the Supabase 'on_auth_user_created' trigger
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authData.user.id)
            .maybeSingle();

        return { profile: profileData as Profile };
    }, []);

    const signOut = useCallback(async () => {
        if (isSupabaseConfigured()) {
            await supabase.auth.signOut();
        }
        setUser(null);
        setProfile(null);
        setTenant(null);
    }, []);

    const refreshAuthData = useCallback(async () => {
        if (user?.id) {
            await loadProfile(user.id);
        }
    }, [user?.id, loadProfile]);

    const signUpFromLead = useCallback(async (data: LeadSignUpData) => {
        if (!isSupabaseConfigured()) {
            setUser({ id: `demo-user-${data.profileType}`, email: data.email });
            setProfile(createDemoProfile(data.profileType));
            setTenant(DEMO_TENANT);
            return {};
        }

        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    full_name: data.fullName,
                    phone: data.phone,
                    profile_type: data.profileType,
                }
            }
        });

        if (error) return { error: error.message };
        if (!authData.user) return { error: 'Erro ao criar conta' };

        // Profile is automatically created by the Supabase 'on_auth_user_created' trigger
        const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authData.user.id)
            .maybeSingle();

        return { profile: profileData as Profile };
    }, []);

    const setDemoProfile = useCallback((profileType: ProfileType) => {
        const demoUser = { id: `demo-user-${profileType}`, email: 'demo@xpert.com' };
        setUser(demoUser);
        setProfile(createDemoProfile(profileType));
        setTenant(DEMO_TENANT);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user,
                profile,
                tenant,
                isLoading,
                isAuthenticated: !!user,
                signIn,
                signUp,
                signUpFromLead,
                signOut,
                refreshAuthData,
                setDemoProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

export default AuthContext;

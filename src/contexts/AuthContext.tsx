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
        if (!isSupabaseConfigured()) return { error: 'Sistema de autenticação não configurado.' };

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
        if (!isSupabaseConfigured()) return { error: 'Sistema de cadastro não configurado.' };

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
        if (!isSupabaseConfigured()) return { error: 'Sistema de cadastro não configurado.' };

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

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, ProfileType, Conversation } from '../types';
import { streamChat } from '../services/gemini';
import { generateId } from '../utils/formatters';
import { GUEST_MESSAGE_LIMIT } from '../config/agents';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../services/supabase';

// Helper to check if a string is a valid UUID
const isUUID = (id: string) => {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
};

// Storage keys
const STORAGE_KEY_PREFIX = 'xpert_chat_';

interface UseChatReturn {
    messages: Message[];
    conversations: Conversation[];
    currentConversation: Conversation | null;
    isStreaming: boolean;
    guestMessageCount: number;
    isGuestLimitReached: boolean;
    isLoadingHistory: boolean;
    sendMessage: (content: string) => void;
    deleteConversation: (id: string) => Promise<void>;
    startNewConversation: () => void;
    selectConversation: (conv: Conversation) => void;
}

export function useChat(agentType: ProfileType): UseChatReturn {
    const { isAuthenticated, profile, tenant } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [guestMessageCount, setGuestMessageCount] = useState(0);
    const abortRef = useRef<AbortController | null>(null);
    const lastFetchedIdRef = useRef<string | null>(null);
    const lastSentAtRef = useRef<number>(0);
    const SEND_RATE_LIMIT_MS = 1500; // mínimo 1.5s entre envios

    const isGuestLimitReached = !isAuthenticated && guestMessageCount >= GUEST_MESSAGE_LIMIT;

    // --- Persistence Helpers ---

    const getLocalHistory = useCallback(() => {
        if (!profile?.id) return { conversations: [], messagesMap: {} };
        const key = `${STORAGE_KEY_PREFIX}${profile.id}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : { conversations: [], messagesMap: {} };
    }, [profile]);

    const saveLocalHistory = useCallback((convs: Conversation[], msgsMap: Record<string, Message[]>) => {
        if (!profile?.id) return;
        const key = `${STORAGE_KEY_PREFIX}${profile.id}`;
        localStorage.setItem(key, JSON.stringify({ conversations: convs, messagesMap: msgsMap }));
    }, [profile]);

    // Load conversations for the current agent type
    useEffect(() => {
        const fetchConversations = async () => {
            if (!isAuthenticated || !profile) return;
            setIsLoadingHistory(true);

            // CASE 1: Demo User (localStorage)
            if (profile.id.includes('demo')) {
                const local = getLocalHistory();
                const filtered = local.conversations.filter((c: Conversation) => c.agent_type === agentType);
                setConversations(filtered);
            }
            // CASE 2: Real User (Supabase)
            else if (isSupabaseConfigured() && isUUID(profile.id)) {
                const { data, error } = await supabase
                    .from('conversations')
                    .select('*')
                    .eq('profile_id', profile.id)
                    .eq('agent_type', agentType)
                    .order('updated_at', { ascending: false });

                if (!error && data) {
                    setConversations(data as Conversation[]);
                }
            }
            setIsLoadingHistory(false);
        };

        fetchConversations();
    }, [isAuthenticated, profile, agentType, getLocalHistory]);

    // Load messages when currentConversation changes
    useEffect(() => {
        const fetchMessages = async () => {
            if (!currentConversation?.id || !isAuthenticated || !profile) {
                lastFetchedIdRef.current = null;
                return;
            }

            // Skip if already loaded in state (prevents race condition on new conversations)
            if (currentConversation.id === lastFetchedIdRef.current) return;

            // CASE 1: Demo User (localStorage)
            if (currentConversation.id.includes('demo') || profile.id.includes('demo')) {
                const local = getLocalHistory();
                setMessages(local.messagesMap[currentConversation.id] || []);
                lastFetchedIdRef.current = currentConversation.id;
            }
            // CASE 2: Real User (Supabase)
            else if (isSupabaseConfigured() && isUUID(currentConversation.id)) {
                const { data, error } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('conversation_id', currentConversation.id)
                    .order('created_at', { ascending: true });

                if (!error && data) {
                    setMessages(data as Message[]);
                    lastFetchedIdRef.current = currentConversation.id;
                }
            }
        };

        if (currentConversation) {
            fetchMessages();
        } else {
            setMessages([]);
            lastFetchedIdRef.current = null;
        }
    }, [currentConversation?.id, currentConversation, isAuthenticated, profile, getLocalHistory]);

    const startNewConversation = useCallback(() => {
        setCurrentConversation(null);
        setMessages([]);
    }, []);

    const selectConversation = useCallback((conv: Conversation) => {
        setCurrentConversation(conv);
    }, []);

    const sendMessage = useCallback(
        async (content: string) => {
            if (isStreaming || !content.trim()) return;
            if (isGuestLimitReached) return;

            const now = Date.now();
            if (now - lastSentAtRef.current < SEND_RATE_LIMIT_MS) return;
            lastSentAtRef.current = now;

            let activeConv = currentConversation;

            // 1. Create or Identify conversation
            if (!activeConv && isAuthenticated && profile) {
                // CASE 1: Demo User (Local Creation)
                if (profile.id.includes('demo')) {
                    activeConv = {
                        id: `demo-conv-${generateId()}`,
                        profile_id: profile.id,
                        tenant_id: tenant?.id || 'demo-tenant',
                        agent_type: agentType,
                        title: content.slice(0, 50),
                        tokens_used: 0,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    };
                    const local = getLocalHistory();
                    local.conversations = [activeConv, ...local.conversations];
                    local.messagesMap[activeConv.id] = [];
                    saveLocalHistory(local.conversations, local.messagesMap);

                    setConversations(prev => [activeConv!, ...prev]);
                    setCurrentConversation(activeConv);
                }
                // CASE 2: Real User (Supabase Insertion)
                else if (isSupabaseConfigured() && isUUID(profile.id)) {
                    const { data, error } = await supabase
                        .from('conversations')
                        .insert({
                            profile_id: profile.id,
                            tenant_id: profile.tenant_id || null,
                            agent_type: agentType,
                            title: content.slice(0, 50),
                        })
                        .select()
                        .single();

                    if (!error && data) {
                        activeConv = data as Conversation;
                        lastFetchedIdRef.current = activeConv.id; // Mark as loaded to prevent effect wipe
                        setCurrentConversation(activeConv);
                        setConversations(prev => [activeConv!, ...prev]);
                    }
                }
            }

            // 2. Add user message locally
            const userMessage: Message = {
                id: generateId(),
                conversation_id: activeConv?.id || 'temp',
                role: 'user',
                content,
                created_at: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, userMessage]);

            if (!isAuthenticated) {
                setGuestMessageCount((prev) => prev + 1);
            }

            // 3. Persist user message
            if (isAuthenticated && activeConv && profile) {
                if (activeConv.id.includes('demo')) {
                    const local = getLocalHistory();
                    local.messagesMap[activeConv.id] = [...(local.messagesMap[activeConv.id] || []), userMessage];
                    saveLocalHistory(local.conversations, local.messagesMap);
                } else if (isSupabaseConfigured() && isUUID(activeConv.id)) {
                    await supabase.from('messages').insert({
                        conversation_id: activeConv.id,
                        role: 'user',
                        content: content,
                    });
                }
            }

            // 4. Prepare assistant message
            const assistantId = generateId();
            const assistantMessage: Message = {
                id: assistantId,
                conversation_id: activeConv?.id || 'temp',
                role: 'assistant',
                content: '',
                created_at: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setIsStreaming(true);

            // Abort previous stream
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            // Build message history for the API
            const chatMessages = [...messages, userMessage].map((m) => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
            }));

            streamChat(
                chatMessages,
                agentType,
                {
                    onToken: (token) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId ? { ...m, content: m.content + token } : m
                            )
                        );
                    },
                    onComplete: async (fullText, usage) => {
                        const finalAssistantMsg = {
                            ...assistantMessage,
                            content: fullText,
                            tokens_input: usage.prompt_tokens,
                            tokens_output: usage.completion_tokens,
                        };

                        setMessages((prev) =>
                            prev.map((m) => m.id === assistantId ? finalAssistantMsg : m)
                        );
                        setIsStreaming(false);

                        // 5. Persist assistant message
                        if (isAuthenticated && activeConv && profile) {
                            if (activeConv.id.includes('demo')) {
                                const local = getLocalHistory();
                                local.messagesMap[activeConv.id] = [...(local.messagesMap[activeConv.id] || []), finalAssistantMsg];
                                saveLocalHistory(local.conversations, local.messagesMap);
                            } else if (isSupabaseConfigured() && isUUID(activeConv.id)) {
                                await supabase.from('messages').insert({
                                    conversation_id: activeConv.id,
                                    role: 'assistant',
                                    content: fullText,
                                    tokens_input: usage.prompt_tokens,
                                    tokens_output: usage.completion_tokens,
                                });

                                await supabase.rpc('increment_conversation_tokens', {
                                    p_conv_id: activeConv.id,
                                    p_tokens: usage.prompt_tokens + usage.completion_tokens
                                });
                            }
                        }
                    },
                    onError: (error) => {
                        console.error('Chat error:', error);
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId
                                    ? { ...m, content: 'Desculpe, ocorreu um erro. Por favor, tente novamente.' }
                                    : m
                            )
                        );
                        setIsStreaming(false);
                    },
                },
                tenant,
                profile,
                controller.signal
            );
        },
        [messages, isStreaming, currentConversation, agentType, isAuthenticated, isGuestLimitReached, profile, tenant, getLocalHistory, saveLocalHistory]
    );

    const deleteConversation = useCallback(
        async (conversationId: string) => {
            // CASE 1: Demo User (localStorage)
            if (profile?.id.includes('demo') || conversationId.includes('demo')) {
                const local = getLocalHistory();
                local.conversations = local.conversations.filter((c: Conversation) => c.id !== conversationId);
                delete local.messagesMap[conversationId];
                saveLocalHistory(local.conversations, local.messagesMap);
                setConversations(local.conversations.filter((c: Conversation) => c.agent_type === agentType));
            }
            // CASE 2: Real User (Supabase)
            else if (isSupabaseConfigured() && isUUID(conversationId)) {
                const { error } = await supabase
                    .from('conversations')
                    .delete()
                    .eq('id', conversationId);

                if (!error) {
                    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
                } else {
                    console.error('Erro ao excluir conversa:', error);
                    alert(`Não foi possível excluir a conversa: ${error.message}`);
                }
            }

            if (currentConversation?.id === conversationId) {
                setCurrentConversation(null);
                setMessages([]);
            }
        },
        [profile, agentType, getLocalHistory, saveLocalHistory, currentConversation]
    );

    return {
        messages,
        conversations,
        currentConversation,
        isStreaming,
        guestMessageCount,
        isGuestLimitReached,
        isLoadingHistory,
        sendMessage,
        deleteConversation,
        startNewConversation,
        selectConversation,
    };
}

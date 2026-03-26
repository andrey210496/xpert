import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    Building2,
    Users,
    Zap,
    Settings,
    LogOut,
    TrendingUp,
    ChevronRight,
    ShieldAlert,
    Search,
    Plus,
    Bot,
    User,
} from 'lucide-react';
import { AgentsConfig } from '../components/superadmin/AgentsConfig';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Card, Badge, Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { formatTokenCount } from '../utils/tokenCalculator';
import { supabase } from '../services/supabase';
import { CreateTenantModal } from '../components/superadmin/CreateTenantModal';
import { EditTenantModal } from '../components/superadmin/EditTenantModal';
import { LeadDetailsModal } from '../components/superadmin/LeadDetailsModal';

// Type definitions for the new metrics
interface PlatformStats {
    total_users_count: number;
    total_tokens_consumed_count: number;
    daily_usage_json: { date: string, tokens: number }[];
}

interface PlanPrices {
    starter: number;
    pro: number;
    enterprise: number;
}

interface SuperAdminDashboardProps {
    onNavigateHome: () => void;
}

interface TenantData {
    id: string;
    name: string;
    plan: string;
    status: string;
    plan_tokens_total: number;
    token_balance: number;
    active_users?: number;
    created_at?: string;
    slug?: string;
    tenant_context?: string;
}

interface LeadData {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    status: string;
    source: string;
    created_at: string;
}

export default function SuperAdminDashboard({ onNavigateHome }: SuperAdminDashboardProps) {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'tenants' | 'leads' | 'settings' | 'agents'>('overview');
    const [searchTerm, setSearchTerm] = useState('');
    const [tenantsList, setTenantsList] = useState<TenantData[]>([]);
    const [leadsRealList, setLeadsRealList] = useState<LeadData[]>([]);
    const [selectedLead, setSelectedLead] = useState<LeadData | null>(null);
    const [selectedTenant, setSelectedTenant] = useState<TenantData | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditTenantModalOpen, setIsEditTenantModalOpen] = useState(false);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [isLoadingTenants, setIsLoadingTenants] = useState(true);
    const [isLoadingLeads, setIsLoadingLeads] = useState(true);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
    const [planPrices, setPlanPrices] = useState<PlanPrices>({ starter: 199, pro: 499, enterprise: 1199 });
    const [isSavingPrices, setIsSavingPrices] = useState(false);

    // Knowledge Base integration settings removed (using agents' text-based KB now)

    const loadTenants = async () => {
        setIsLoadingTenants(true);
        const { data } = await supabase.from('tenants').select('*').order('created_at', { ascending: false });
        if (data) setTenantsList(data);
        setIsLoadingTenants(false);
        return data ?? [];
    };

    const handleEditTenantSuccess = async () => {
        const fresh = await loadTenants();
        setSelectedTenant(prev => {
            if (!prev) return prev;
            const updated = fresh.find((t: TenantData) => t.id === prev.id);
            return updated ?? prev;
        });
    };

    const loadLeads = async () => {
        setIsLoadingLeads(true);
        const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
        if (data) setLeadsRealList(data);
        setIsLoadingLeads(false);
    };

    const loadDashboardData = async () => {
        setIsLoadingStats(true);
        // Load global usage stats via RPC
        const { data: statsData, error: statsError } = await supabase.rpc('get_platform_usage_stats');
        if (!statsError && statsData && statsData[0]) {
            setPlatformStats(statsData[0]);
        }
        
        // Load plan prices from platform_settings
        const { data: settingsData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'plan_prices')
            .single();
        
        if (settingsData?.value) {
            setPlanPrices(settingsData.value);
        }
        
        setIsLoadingStats(false);
    };

    const handleSavePrices = async () => {
        setIsSavingPrices(true);
        const { error } = await supabase
            .from('platform_settings')
            .upsert({ key: 'plan_prices', value: planPrices });
        
        if (error) {
            alert('Erro ao salvar preços: ' + error.message);
        } else {
            alert('Preços atualizados com sucesso!');
        }
        setIsSavingPrices(false);
    };

    useEffect(() => {
        if (activeTab === 'overview' || activeTab === 'settings') {
            loadDashboardData();
        }
        if (activeTab === 'tenants' || activeTab === 'overview') {
            loadTenants();
        }
        if (activeTab === 'leads') {
            loadLeads();
        }
    }, [activeTab]);

    // KB action handlers removed

    const handleViewLead = (lead: LeadData) => {
        setSelectedLead(lead);
        setIsLeadModalOpen(true);
    };

    const LEAD_STATUS_STYLE: Record<string, string> = {
        new: 'bg-accent/10 text-accent border-accent/30',
        contacted: 'bg-warning/10 text-warning border-warning/30',
        converted: 'bg-success/10 text-success border-success/30',
        lost: 'bg-error/10 text-error border-error/30',
    };

    const LEAD_STATUS_LABEL: Record<string, string> = {
        new: 'Novo', contacted: 'Contato', converted: 'Venda', lost: 'Perdido',
    };

    const totalTokensUsed = tenantsList.reduce((acc, t) => acc + ((t.plan_tokens_total || 0) - (t.token_balance || 0)), 0);
    const totalTokensAllocated = tenantsList.reduce((acc, t) => acc + (t.plan_tokens_total || 0), 0);

    const estimatedMRR = tenantsList.reduce((acc, t) => {
        if (t.status !== 'active') return acc;
        const price = planPrices[t.plan as keyof PlanPrices] || 0;
        return acc + price;
    }, 0);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'success';
            case 'warning': return 'warning';
            case 'critical': return 'error';
            default: return 'text-tertiary';
        }
    };

    return (
        <div className="min-h-screen bg-bg-primary">
            <CreateTenantModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadTenants}
            />
            <EditTenantModal
                isOpen={isEditTenantModalOpen}
                onClose={() => { setIsEditTenantModalOpen(false); setSelectedTenant(null); }}
                tenant={selectedTenant}
                onSuccess={handleEditTenantSuccess}
            />
            <LeadDetailsModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                lead={selectedLead}
                onUpdate={() => { loadLeads(); }}
            />
            {/* Top Nav */}
            <header className="h-14 px-6 border-b border-border-subtle flex items-center justify-between bg-bg-primary/50 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button onClick={onNavigateHome} className="text-accent font-bold text-lg cursor-pointer">
                        XPERT
                    </button>
                    <span className="text-text-tertiary">/</span>
                    <span className="text-sm font-medium text-accent flex items-center gap-1.5">
                        <ShieldAlert size={16} /> SuperAdmin
                    </span>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setUserMenuOpen(v => !v)}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-bg-secondary border border-transparent hover:border-border-subtle transition-all cursor-pointer"
                    >
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-bold text-text-primary leading-tight">Super Admin</div>
                            <div className="text-[10px] text-text-tertiary uppercase tracking-widest">SuperAdmin</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                            <User size={16} />
                        </div>
                    </button>

                    <AnimatePresence>
                        {userMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-56 bg-bg-primary border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                                >
                                    <div className="px-4 py-3 border-b border-border-subtle">
                                        <div className="text-[10px] uppercase tracking-widest font-bold text-text-tertiary">Conta Ativa</div>
                                        <div className="text-sm font-bold text-text-primary mt-0.5 truncate">Super Admin</div>
                                        <div className="text-[10px] text-accent font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1">
                                            <ShieldAlert size={10} /> SuperAdmin
                                        </div>
                                    </div>
                                    <div className="p-1.5">
                                        <button
                                            onClick={async () => { setUserMenuOpen(false); await signOut(); onNavigateHome(); }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-error hover:bg-error/10 transition-colors cursor-pointer font-medium"
                                        >
                                            <LogOut size={15} />
                                            Sair da Conta
                                        </button>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar Nav */}
                <nav className="w-56 border-r border-border-subtle p-4 hidden lg:block min-h-[calc(100vh-56px)] sticky top-14">
                    {[
                        { id: 'overview', label: 'Visão Global', Icon: BarChart3 },
                        { id: 'tenants', label: 'Condomínios', Icon: Building2 },
                        { id: 'leads', label: 'Leads & Vendas', Icon: Users },
                        { id: 'agents', label: 'Agentes de IA', Icon: Bot },
                        { id: 'settings', label: 'Config. do Sistema', Icon: Settings },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                if ('route' in item && item.route) {
                                    navigate(item.route);
                                    return;
                                }
                                setActiveTab(item.id as typeof activeTab);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm mb-1 transition-colors cursor-pointer ${activeTab === item.id
                                ? 'bg-accent/10 text-accent font-medium border border-accent/20'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary border border-transparent'
                                }`}
                        >
                            <item.Icon size={18} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Main Content */}
                <main className="flex-1 p-6 lg:p-8 max-w-7xl mx-auto w-full">
                    {/* Mobile Tabs */}
                    <div className="flex gap-2 mb-6 lg:hidden overflow-x-auto pb-2 scrollbar-hide">
                        {['overview', 'tenants', 'leads', 'agents', 'settings'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as typeof activeTab)}
                                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap cursor-pointer border ${activeTab === tab
                                    ? 'bg-accent/10 text-accent border-accent/20'
                                    : 'text-text-secondary border-transparent bg-bg-secondary'
                                    }`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'overview' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            <div>
                                <h1 className="text-2xl font-bold text-text-primary">Visão Global da Plataforma</h1>
                                <p className="text-text-secondary mt-1">Métricas em tempo real de todos os condomínios.</p>
                            </div>

                            {/* Stat Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                <Card variant="default" className="p-5 border-accent/20">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-text-tertiary uppercase tracking-wide">MRR Estimado</span>
                                        <div className="p-1.5 rounded-lg bg-accent/10">
                                            <TrendingUp size={16} className="text-accent" />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-text-primary">
                                        {isLoadingStats ? '...' : estimatedMRR.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 text-success">
                                        <TrendingUp size={14} />
                                        <span className="text-xs">Baseado em planos ativos</span>
                                    </div>
                                </Card>

                                <Card variant="default" className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-text-tertiary uppercase tracking-wide">Tokens Consumidos</span>
                                        <div className="p-1.5 rounded-lg bg-[#00D4FF]/10">
                                            <Zap size={16} className="text-[#00D4FF]" />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-text-primary">
                                        {formatTokenCount(totalTokensUsed)}
                                    </div>
                                    <p className="text-xs text-text-tertiary mt-1">
                                        De {formatTokenCount(totalTokensAllocated)} alocados
                                    </p>
                                </Card>

                                <Card variant="default" className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-text-tertiary uppercase tracking-wide">Tenants Ativos</span>
                                        <div className="p-1.5 rounded-lg bg-[#A855F7]/10">
                                            <Building2 size={16} className="text-[#A855F7]" />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-text-primary">
                                        {tenantsList.length}
                                    </div>
                                    <p className="text-xs text-text-tertiary mt-1">
                                        Condomínios gerenciados
                                    </p>
                                </Card>

                                <Card variant="default" className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs text-text-tertiary uppercase tracking-wide">Total de Usuários</span>
                                        <div className="p-1.5 rounded-lg bg-[#FF6B35]/10">
                                            <Users size={16} className="text-[#FF6B35]" />
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-text-primary">
                                        {isLoadingStats ? '...' : (platformStats?.total_users_count || 0)}
                                    </div>
                                    <p className="text-xs text-text-tertiary mt-1">
                                        Moradores, síndicos e funcionários
                                    </p>
                                </Card>
                            </div>

                            {/* Chart */}
                            <Card variant="default" className="p-5">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-sm font-semibold text-text-primary">Consumo Global LLM (IA)</h3>
                                    <Badge variant="morador">Últimos 7 dias</Badge>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={platformStats?.daily_usage_json || []}>
                                            <defs>
                                                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#1A88C9" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#1A88C9" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#2C2C34" vertical={false} />
                                            <XAxis dataKey="date" stroke="#636366" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#636366" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1C1C24', border: '1px solid #2C2C34', borderRadius: '12px' }}
                                                itemStyle={{ color: '#1A88C9' }}
                                                formatter={(value: number | string | undefined) => [`${formatTokenCount(Number(value || 0))} tokens`, 'Consumo']}
                                            />
                                            <Area type="monotone" dataKey="tokens" stroke="#1A88C9" strokeWidth={3} fillOpacity={1} fill="url(#colorTokens)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'tenants' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-text-primary">Gestão de Condomínios</h2>
                                    <p className="text-sm text-text-secondary">Controle limites, planos e acessos técnicos.</p>
                                </div>
                                <Button className="shrink-0 gap-2" onClick={() => setIsCreateModalOpen(true)}>
                                    <Plus size={16} /> Novo Condomínio
                                </Button>
                            </div>

                            <Card variant="default" className="p-0 overflow-hidden">
                                <div className="p-4 border-b border-border-subtle flex items-center gap-3">
                                    <div className="relative flex-1 max-w-md">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Buscar condomínio..."
                                            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-bg-secondary/50 border-b border-border-subtle">
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase tracking-wider">Condomínio</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase tracking-wider">Plano</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase tracking-wider">Consumo de Tokens</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase tracking-wider">Usuários</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase tracking-wider">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {isLoadingTenants ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-text-tertiary text-sm">
                                                        Carregando condomínios...
                                                    </td>
                                                </tr>
                                            ) : tenantsList.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map((tenant) => {
                                                const tokensUsed = (tenant.plan_tokens_total || 0) - (tenant.token_balance || 0);
                                                return (
                                                    <tr key={tenant.id} className="hover:bg-bg-secondary/30 transition-colors group">
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-2 h-2 rounded-full bg-${getStatusColor(tenant.status)}`} />
                                                                <span className="font-medium text-text-primary">{tenant.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <Badge variant={tenant.plan === 'enterprise' ? 'prestador' : tenant.plan === 'pro' ? 'sindico' : 'morador'}>
                                                                {(tenant.plan || 'starter').toUpperCase()}
                                                            </Badge>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className={tenant.status === 'critical' ? 'text-error font-medium' : 'text-text-secondary'}>
                                                                        {formatTokenCount(tokensUsed)}
                                                                    </span>
                                                                    <span className="text-text-tertiary">{formatTokenCount(tenant.plan_tokens_total || 0)}</span>
                                                                </div>
                                                                <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full bg-${getStatusColor(tenant.status)}`}
                                                                        style={{ width: `${Math.min(100, (tokensUsed / (tenant.plan_tokens_total || 1)) * 100)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 text-sm text-text-secondary">
                                                            --
                                                        </td>
                                                        <td className="p-4">
                                                            <button
                                                                onClick={() => { setSelectedTenant(tenant); setIsEditTenantModalOpen(true); }}
                                                                className="text-sm text-accent hover:underline flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer"
                                                            >
                                                                Gerenciar <ChevronRight size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'leads' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-bold text-text-primary">Leads Capturados</h2>
                                    <p className="text-sm text-text-secondary">Interessados via formulário da landing page.</p>
                                </div>
                                <Button size="sm" variant="secondary" onClick={loadLeads} isLoading={isLoadingLeads}>
                                    Atualizar
                                </Button>
                            </div>

                            <Card variant="default" className="p-0 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-bg-secondary/50 border-b border-border-subtle">
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase">Data</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase">Nome</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase">Contato</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase">Status</th>
                                                <th className="text-left text-xs text-text-tertiary font-medium p-4 uppercase">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {isLoadingLeads ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-text-tertiary text-sm">
                                                        Carregando leads...
                                                    </td>
                                                </tr>
                                            ) : leadsRealList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-8 text-center text-text-tertiary text-sm">
                                                        Nenhum lead encontrado.
                                                    </td>
                                                </tr>
                                            ) : leadsRealList.map((lead) => (
                                                <tr key={lead.id} className="hover:bg-bg-secondary/30 transition-colors">
                                                    <td className="p-4 text-xs text-text-tertiary">
                                                        {new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </td>
                                                    <td className="p-4 font-medium text-text-primary">
                                                        {lead.first_name} {lead.last_name}
                                                    </td>
                                                    <td className="p-4 text-sm text-text-secondary">
                                                        <div>{lead.email}</div>
                                                        <div className="text-xs text-text-tertiary">{lead.phone}</div>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${LEAD_STATUS_STYLE[lead.status] ?? 'bg-bg-hover text-text-secondary border-border'}`}>
                                                            {LEAD_STATUS_LABEL[lead.status] ?? lead.status}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <Button size="sm" variant="secondary" onClick={() => handleViewLead(lead)}>Ver</Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        </motion.div>
                    )}

                    {activeTab === 'agents' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                            <AgentsConfig />
                        </motion.div>
                    )}

                    {activeTab === 'settings' && planPrices && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                            <div>
                                <h2 className="text-xl font-bold text-text-primary">Configurações do Sistema</h2>
                                <p className="text-sm text-text-secondary mt-1">Gerencie integrações e configurações globais da plataforma.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <Card variant="default" className="p-6">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 rounded-lg bg-accent/10 text-accent">
                                            <TrendingUp size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-text-primary">Preços dos Planos (Mensal)</h3>
                                            <p className="text-xs text-text-tertiary">Valores usados no cálculo do MRR global.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {Object.keys(planPrices).map((plan) => (
                                            <div key={plan} className="flex flex-col gap-1.5">
                                                <label className="text-[10px] uppercase font-bold text-text-tertiary tracking-widest px-1">
                                                    Plano {plan}
                                                </label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs">R$</span>
                                                    <input
                                                        type="number"
                                                        value={planPrices[plan as keyof PlanPrices]}
                                                        onChange={(e) => setPlanPrices({ ...planPrices, [plan]: Number(e.target.value) })}
                                                        className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="pt-4 border-t border-border mt-6">
                                            <Button 
                                                className="w-full" 
                                                onClick={handleSavePrices} 
                                                isLoading={isSavingPrices}
                                            >
                                                Salvar Configurações
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                <Card variant="default" className="p-6 opacity-50 grayscale pointer-events-none">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 rounded-lg bg-text-tertiary/10 text-text-tertiary">
                                            <ShieldAlert size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-text-primary">Segurança & API</h3>
                                            <p className="text-xs text-text-tertiary">Configurações de chaves externas.</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-tertiary italic">Módulo em desenvolvimento...</p>
                                </Card>
                            </div>
                        </motion.div>
                    )}
                </main>
            </div>
        </div >
    );
}

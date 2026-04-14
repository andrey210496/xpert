import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart3,
    Users,
    MessageSquare,
    Zap,
    AlertTriangle,
    Settings,
    LogOut,
    TrendingUp,
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { Card, Badge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { formatTokenCount } from '../utils/tokenCalculator';
import type { ProfileType } from '../types';
import { UserManagement } from '../components/dashboard/UserManagement';
import { ChatWindow } from '../components/chat/ChatWindow';
import { TenantSettings } from '../components/dashboard/TenantSettings';


// Real-time data placeholders
const tokenUsageData: any[] = [];
const profileDistribution: any[] = [];
const recentUsers: any[] = [];

const profileVariant: Record<string, 'sindico' | 'morador' | 'zelador' | 'prestador'> = {
    admin: 'sindico',
    morador: 'morador',
    zelador: 'zelador',
    prestador: 'prestador',
};

const profileLabels: Record<string, string> = {
    admin: 'Síndico',
    morador: 'Morador',
    zelador: 'Zelador',
    prestador: 'Prestador',
};

interface DashboardProps {
    onNavigateHome: () => void;
}

export default function Dashboard({ onNavigateHome }: DashboardProps) {
    const { tenant, profile, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'chat' | 'settings'>('overview');

    const tokenBalance = tenant?.token_balance || 0;
    const tokenTotal = tenant?.plan_tokens_total || 1_000_000;
    const tokenUsed = tokenTotal - tokenBalance;
    const tokenPercent = Math.min(Math.round((tokenBalance / tokenTotal) * 100), 100);
    const isLow = tokenPercent <= 20;
    const isCritical = tokenPercent <= 5;

    return (
        <div className="min-h-screen bg-bg-primary font-sans">
            {/* Top Bar (Linear Style) */}
            <header className="h-14 px-4 border-b border-border bg-bg-primary flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onNavigateHome}
                        className="text-text-primary font-extrabold text-sm tracking-tighter cursor-pointer hover:opacity-80 font-display"
                    >
                        XPERT
                    </button>
                    <span className="text-text-tertiary font-light text-xs">/</span>
                    <span className="text-xs font-semibold text-text-secondary tracking-tight">DASHBOARD</span>
                </div>
                <div className="flex items-center gap-4">
                    <Badge variant={profileVariant[profile?.profile_type || 'admin']}>
                        {profileLabels[profile?.profile_type || 'admin']}
                    </Badge>
                    <div className="h-4 w-px bg-border" />
                    <button
                        onClick={async () => { await signOut(); onNavigateHome(); }}
                        className="text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            <div className="flex max-w-[1600px] mx-auto">
                {/* Sidebar (Professional Tone) */}
                <nav className="w-60 border-r border-border p-4 hidden lg:flex flex-col gap-1 min-h-[calc(100vh-56px)] sticky top-14 bg-bg-primary">
                    {[
                        { id: 'overview', label: 'Visão Geral', Icon: BarChart3 },
                        { id: 'users', label: 'Usuários', Icon: Users },
                        { id: 'chat', label: 'Assistente Virtual', Icon: MessageSquare },
                        { id: 'settings', label: 'Configurações', Icon: Settings },
                    ].map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id as typeof activeTab)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 cursor-pointer group ${activeTab === item.id
                                ? 'bg-accent/10 text-accent border-l-2 border-accent font-semibold'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                                }`}
                        >
                            <item.Icon size={16} className={`${activeTab === item.id ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary'}`} />
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* Main Content Area */}
                <main className="flex-1 p-4 sm:p-6 md:p-8">
                    {/* Mobile Tab Navigation */}
                    <div className="flex gap-2 mb-6 lg:hidden overflow-x-auto pb-2">
                        {[
                            { id: 'overview', label: 'Visão Geral', Icon: BarChart3 },
                            { id: 'users', label: 'Usuários', Icon: Users },
                            { id: 'chat', label: 'Assistente', Icon: MessageSquare },
                            { id: 'settings', label: 'Config', Icon: Settings },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as typeof activeTab)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer border transition-colors ${activeTab === item.id
                                        ? 'bg-accent/10 text-accent border-accent/20'
                                        : 'text-text-secondary border-transparent bg-bg-tertiary hover:bg-bg-hover'
                                    }`}
                            >
                                <item.Icon size={14} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                    {activeTab === 'overview' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                            {/* Simple Alert Bar */}
                            {(isLow || isCritical) && (
                                <div className={`flex items-center gap-3 px-4 py-2 text-xs border-l-4 ${isCritical ? 'bg-error/5 border-error text-error' : 'bg-warning/5 border-warning text-warning'}`}>
                                    <AlertTriangle size={14} />
                                    <p className="font-medium">
                                        {isCritical ? 'CRÍTICO: Upgrade de plano necessário imediatamente.' : 'AVISO: Saldo de tokens abaixo de 20%.'}
                                    </p>
                                </div>
                            )}

                            {/* Stats Grid (Mono Type) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                {[
                                    { label: 'Saldo de Tokens', value: formatTokenCount(tokenBalance).replace(' tokens', ''), sub: `${tokenPercent}% restante`, Icon: Zap },
                                    { label: 'Consumo Semanal', value: formatTokenCount(tokenUsed).replace(' tokens', ''), sub: 'Dados reais', Icon: TrendingUp, trend: 'up' },
                                    { label: 'Usuários Ativos', value: recentUsers.filter(u => u.active).length.toString(), sub: `de ${recentUsers.length} total`, Icon: Users },
                                    { label: 'Interações Hoje', value: '0', sub: 'Sem atividade', Icon: MessageSquare },
                                ].map((stat) => (
                                    <Card key={stat.label} variant="default" className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase tracking-widest text-text-tertiary font-mono font-bold">{stat.label}</span>
                                            <stat.Icon size={14} className="text-text-tertiary" />
                                        </div>
                                        <div>
                                            <div className="text-3xl font-bold text-text-primary font-display tracking-tight flex items-baseline gap-1">
                                                {stat.value}
                                                <span className="text-xs text-text-tertiary font-mono font-medium lowercase">units</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 text-[10px] font-mono font-bold uppercase tracking-tight">
                                                <span className={stat.trend === 'up' ? 'text-success' : 'text-text-secondary'}>{stat.sub}</span>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                                <Card className="xl:col-span-2">
                                    <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest font-mono mb-6">Analítico de Consumo</h3>
                                    <div className="h-[300px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={tokenUsageData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                <XAxis
                                                    dataKey="date"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                                                />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                                                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                                                />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0E1520', border: '1px solid #1E293B', borderRadius: '8px', fontSize: '10px' }}
                                                />
                                                <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={1.5} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Card>

                                <Card>
                                    <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest font-mono mb-6">Pesos de Perfil</h3>
                                    <div className="h-[200px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={profileDistribution}
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                >
                                                    {profileDistribution.map((entry, i) => (
                                                        <Cell key={i} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2 mt-4">
                                        {profileDistribution.map((item) => (
                                            <div key={item.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                                                    <span className="text-[10px] uppercase font-bold text-text-tertiary font-display">{item.name}</span>
                                                </div>
                                                <span className="text-xs font-mono text-text-primary font-bold">0%</span>
                                            </div>
                                        ))}
                                    </div>
                                </Card>
                            </div>

                            {/* Table List (Editorial Style) */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-text-tertiary uppercase tracking-widest font-mono">Logs de Operação</h3>
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs bg-bg-secondary min-w-[600px]">
                                            <thead>
                                                <tr className="bg-bg-tertiary/50 border-b border-border">
                                                    <th className="px-6 py-3 font-bold text-text-tertiary uppercase tracking-widest">Identidade</th>
                                                    <th className="px-6 py-3 font-bold text-text-tertiary uppercase tracking-widest">Atribuição</th>
                                                    <th className="px-6 py-3 font-bold text-text-tertiary uppercase tracking-widest">Consumo</th>
                                                    <th className="px-6 py-3 font-bold text-text-tertiary uppercase tracking-widest text-right">Acesso</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/50">
                                                {recentUsers.map((user, i) => (
                                                    <tr key={i} className="hover:bg-bg-hover/50 transition-colors">
                                                        <td className="px-6 py-4 font-semibold text-text-primary">{user.name}</td>
                                                        <td className="px-6 py-4">
                                                            <Badge variant={profileVariant[user.type]} showDot={false}>{profileLabels[user.type]}</Badge>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono text-text-secondary">{formatTokenCount(user.tokens)}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span className={user.active ? 'status-dot-active' : 'w-1.5 h-1.5 rounded-full bg-text-muted'} />
                                                                <span className="text-[10px] uppercase font-bold text-text-tertiary">{user.active ? 'Ativo' : 'Offline'}</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'users' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                            <UserManagement />
                        </motion.div>
                    )}

                    {activeTab === 'chat' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="h-[calc(100vh-140px)] w-full relative bg-bg-secondary rounded-xl overflow-hidden border border-border">
                            <ChatWindow embeddedAgentType="admin" />
                        </motion.div>
                    )}

                    {activeTab === 'settings' && (
                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                            <TenantSettings />
                        </motion.div>
                    )}
                </main>
            </div>
        </div>
    );
}

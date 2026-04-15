import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { X } from 'lucide-react';
export * from './Logo';

// ===== Button =====

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    isLoading,
    className = '',
    disabled,
    ...props
}: ButtonProps) {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-sans';

    const variants: Record<string, string> = {
        primary: 'bg-accent text-white hover:bg-accent-hover active:scale-[0.98]',
        secondary: 'bg-transparent border border-border-strong text-text-primary hover:bg-bg-hover active:scale-[0.98]',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
        danger: 'bg-error/10 text-error border border-error/20 hover:bg-error/20 active:scale-[0.98]',
    };

    const sizes: Record<string, string> = {
        sm: 'px-3 py-1.5 text-xs gap-1.5',
        md: 'px-6 py-2.5 text-sm gap-2',
        lg: 'px-8 py-3.5 text-base gap-2.5',
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin h-3.5 w-3.5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            )}
            {children}
        </button>
    );
}

// ===== Input =====

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    mono?: boolean;
}

export function Input({ label, error, mono, className = '', ...props }: InputProps) {
    return (
        <div className="flex flex-col gap-1.5 focus-within:group">
            {label && (
                <label className="text-[10px] uppercase tracking-widest text-text-secondary font-display font-semibold mb-0.5">
                    {label}
                </label>
            )}
            <input
                className={`h-10 w-full px-3 bg-bg-secondary border border-border rounded-md text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/20 ${mono ? 'font-mono text-sm' : 'font-sans text-sm'} ${error ? 'border-error' : ''} ${className}`}
                {...props}
            />
            {error && <span className="text-[10px] text-error font-medium">{error}</span>}
        </div>
    );
}

// ===== Modal =====

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    if (!isOpen) return null;

    const sizes: Record<string, string> = {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-bg-primary/40 backdrop-blur-md" />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={`relative w-full ${sizes[size]} glass-premium border-glow-premium p-5 sm:p-8 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-border-strong rounded-2xl`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-extrabold text-text-primary tracking-tight font-display">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
                {children}
            </motion.div>
        </motion.div>
    );
}

// ===== Card =====

interface CardProps extends HTMLMotionProps<'div'> {
    children: React.ReactNode;
    variant?: 'default' | 'bordered' | 'flat';
    className?: string;
}

export function Card({ children, variant = 'default', className = '', ...props }: CardProps) {
    const variants: Record<string, string> = {
        default: 'surface-card p-5',
        bordered: 'bg-transparent border border-border-strong rounded-lg p-5',
        flat: 'bg-bg-tertiary rounded-lg p-5',
    };

    return (
        <motion.div className={`${variants[variant]} ${className}`} {...props}>
            {children}
        </motion.div>
    );
}

// ===== Badge =====

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'sindico' | 'morador' | 'zelador' | 'prestador' | 'neutral';
    className?: string;
    showDot?: boolean;
}

export function Badge({ children, variant = 'neutral', className = '', showDot = true }: BadgeProps) {
    const variants: Record<string, string> = {
        sindico: 'bg-sindico/10 text-sindico border-sindico/20',
        morador: 'bg-morador/10 text-morador border-morador/20',
        zelador: 'bg-zelador/10 text-zelador border-zelador/20',
        prestador: 'bg-prestador/10 text-prestador border-prestador/20',
        neutral: 'bg-bg-hover text-text-secondary border-border',
    };

    const dotColors: Record<string, string> = {
        sindico: 'bg-sindico',
        morador: 'bg-morador',
        zelador: 'bg-zelador',
        prestador: 'bg-prestador',
        neutral: 'bg-text-tertiary',
    };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold font-display rounded-full border ${variants[variant]} ${className}`}>
            {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
            {children}
        </span>
    );
}

// ===== ProgressBar =====

export function ProgressBar({ value, max = 100, className = '' }: { value: number; max?: number; className?: string }) {
    const percentage = Math.min(Math.round((value / max) * 100), 100);

    return (
        <div className={`w-full h-1 bg-border-subtle rounded-full overflow-hidden ${className}`}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 1, ease: 'circOut' }}
                className="h-full bg-accent"
            />
        </div>
    );
}

// ===== Other existing exports maintained for compatibility but refined =====

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
}

export function TextArea({ label, className = '', ...props }: TextAreaProps) {
    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label className="text-[10px] uppercase tracking-widest text-text-secondary font-display font-semibold mb-0.5">
                    {label}
                </label>
            )}
            <textarea
                className={`w-full px-3 py-2 bg-bg-secondary border border-border rounded-md text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:ring-1 focus:ring-accent/20 resize-none font-sans text-sm ${className}`}
                {...props}
            />
        </div>
    );
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | number;
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
    const navigate = useNavigate();

    const sizeMap: Record<string, string> = {
        sm: 'h-8',
        md: 'h-10',
        lg: 'h-14',
    };

    const heightClass = typeof size === 'number' ? `h-[${size}px]` : sizeMap[size] || sizeMap.md;

    return (
        <button
            onClick={() => navigate('/')}
            className={`group relative flex items-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${className}`}
            aria-label="Voltar para Início"
        >
            {/* Subtle radial glow behind logo on hover */}
            <div className="absolute inset-0 bg-accent/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full scale-150" />
            
            <img 
                src={logo} 
                alt="XPERT.ia" 
                className={`${heightClass} w-auto object-contain relative z-10 transition-filter duration-300 group-hover:brightness-110`}
            />

            {/* Shimmer effect overlay */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-0 group-hover:opacity-20 transition-opacity duration-300">
                <div className="absolute inset-0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out bg-gradient-to-r from-transparent via-white to-transparent skew-x-12" />
            </div>
        </button>
    );
}

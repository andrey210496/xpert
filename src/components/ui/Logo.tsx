import { useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';

interface LogoProps {
    className?: string;
    size?: 'sm' | 'md' | 'lg' | number;
}

export function Logo({ className = '', size = 'md' }: LogoProps) {
    const navigate = useNavigate();

    const sizeMap: Record<string, string> = {
        sm: 'h-6',
        md: 'h-8',
        lg: 'h-12',
    };

    const heightClass = typeof size === 'number' ? `h-[${size}px]` : sizeMap[size] || sizeMap.md;

    return (
        <button
            onClick={() => navigate('/')}
            className={`group relative flex items-center gap-2 cursor-pointer ${className}`}
            aria-label="Voltar para Início"
        >
            <img 
                src={logo} 
                alt="XPERT.ia" 
                className={`${heightClass} w-auto object-contain transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]`}
            />
        </button>
    );
}

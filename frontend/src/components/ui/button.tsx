import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { clsx } from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

const base = 'inline-flex items-center justify-center rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50';
const variants = {
  default: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400',
  outline: 'border border-slate-700 bg-slate-900/60 text-slate-100 hover:border-slate-500',
  ghost: 'bg-transparent text-slate-200 hover:bg-slate-800',
};
const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({ asChild = false, variant = 'default', size = 'md', className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={clsx(base, variants[variant], sizes[size], className)} {...props} />;
}

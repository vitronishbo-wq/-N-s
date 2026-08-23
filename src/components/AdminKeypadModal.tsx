import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Delete, Shield, Check } from 'lucide-react';
import { AdminUser } from '../types';

interface AdminKeypadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (admin: AdminUser) => void;
  dynamicAdmins: AdminUser[];
}

export const FOUNDER_CREDENTIALS = {
  code: '*#7668#',
  name: 'Marcelo Truman',
  email: 'silamarco217@gmail.com',
  phone: '+244948323383',
  pin: '123456',
  role: 'deus_fundador' as const
};

export const AdminKeypadModal: React.FC<AdminKeypadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  dynamicAdmins
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleKeyPress = (char: string) => {
    setError(false);
    if (code.length >= 10) return;
    const nextCode = code + char;
    setCode(nextCode);

    // Auto verify founder code
    if (nextCode === FOUNDER_CREDENTIALS.code) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess({
          id: 'founder_marcelo_truman',
          displayName: FOUNDER_CREDENTIALS.name,
          email: FOUNDER_CREDENTIALS.email,
          phone: FOUNDER_CREDENTIALS.phone,
          role: 'deus_fundador',
          pin: FOUNDER_CREDENTIALS.pin,
          status: 'active',
          createdAt: 1700000000000,
          createdBy: 'system'
        });
        setCode('');
        setSuccess(false);
      }, 400);
      return;
    }

    // Also check dynamic admin pins or codes
    const matchingAdmin = dynamicAdmins.find(a => a.pin === nextCode || `*#${a.pin}#` === nextCode);
    if (matchingAdmin && matchingAdmin.status === 'active') {
      setSuccess(true);
      setTimeout(() => {
        onSuccess(matchingAdmin);
        setCode('');
        setSuccess(false);
      }, 400);
    }
  };

  const handleBackspace = () => {
    setError(false);
    setCode(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setError(false);
    setCode('');
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="w-full max-w-xs bg-stone-900 border border-stone-800 text-stone-100 rounded-3xl p-6 shadow-2xl flex flex-col items-center"
        >
          {/* Top Bar */}
          <div className="w-full flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-400">
              <Shield className="w-3.5 h-3.5 text-rose-500" />
              <span>Acesso Restrito</span>
            </div>
            <button
              type="button"
              id="btn-close-keypad"
              onClick={onClose}
              className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dial Display */}
          <div className="w-full bg-stone-950 border border-stone-800/80 rounded-2xl py-3 px-4 mb-5 text-center min-h-[50px] flex items-center justify-center">
            <span
              className={`font-mono text-xl tracking-widest ${
                success ? 'text-emerald-400 font-bold' : error ? 'text-rose-400' : 'text-stone-200'
              }`}
            >
              {code || <span className="text-stone-600 text-sm tracking-normal">Digitar código...</span>}
            </span>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
            {keys.map(key => (
              <button
                key={key}
                type="button"
                id={`keypad-btn-${key === '*' ? 'star' : key === '#' ? 'hash' : key}`}
                onClick={() => handleKeyPress(key)}
                className="w-16 h-16 rounded-2xl bg-stone-800/70 hover:bg-stone-700 active:bg-rose-600 active:text-white text-stone-100 text-xl font-medium border border-stone-700/50 shadow-sm flex items-center justify-center mx-auto transition"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between w-full max-w-[240px] mt-4 px-2">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-stone-400 hover:text-stone-200 py-1"
            >
              Limpar
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

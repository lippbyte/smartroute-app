import { motion } from "motion/react";

interface LoadingScreenProps {
  message?: string;
  progress?: number; // 0 - 100
}

export default function LoadingScreen({ 
  message = "Memuat Dashboard...", 
  progress = 0 
}: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 z-9999 bg-dark-1 flex flex-col items-center justify-center font-mono text-light-1">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold tracking-wider mb-8"
      >
        Smartroute AI Dashboard
      </motion.div>

      <div className="w-64 h-1 bg-dark-2 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full bg-light-1"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      <motion.p
        key={message}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-light-2"
      >
        {message}
      </motion.p>
    </div>
  );
}
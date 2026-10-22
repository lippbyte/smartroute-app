import { type ReactNode } from "react";
import { motion } from "motion/react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  delay?: number;
  valueClassName?: string;
  iconContainerClassName?: string;
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  delay = 0,
  valueClassName = "text-light-1",
  iconContainerClassName = "bg-dark-2 text-light-1",
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-dark-1 border border-light-1/25 rounded-xl p-5 flex flex-col justify-between gap-3 font-mono"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-light-2 uppercase">
          {title}
        </span>
        <div className={`p-2 rounded-md text-lg ${iconContainerClassName}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className={`text-xl font-bold font-mono ${valueClassName}`}>
          {value}
        </div>
        <p className="text-sm text-light-2 mt-1">{subtitle}</p>
      </div>
    </motion.div>
  );
}
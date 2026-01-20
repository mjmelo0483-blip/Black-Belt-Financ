
import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  icon: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, trendType = 'neutral', color = 'text-primary' }) => {
  return (
    <div className="flex flex-col justify-between rounded-xl p-5 bg-[#233648] border border-[#324d67]/30 shadow-lg hover:border-primary/50 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 bg-[#111a22] rounded-lg ${color}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {trend && (
          <span className={`
            text-sm font-bold flex items-center px-2 py-0.5 rounded
            ${trendType === 'up' ? 'text-[#0bda5b] bg-[#0bda5b]/10' : ''}
            ${trendType === 'down' ? 'text-[#fa6238] bg-[#fa6238]/10' : ''}
            ${trendType === 'neutral' ? 'text-[#92adc9] bg-[#92adc9]/10' : ''}
          `}>
            {trendType !== 'neutral' && (
              <span className="material-symbols-outlined text-[16px] mr-0.5">
                {trendType === 'up' ? 'trending_up' : 'trending_down'}
              </span>
            )}
            {trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-[#92adc9] text-sm font-medium mb-1">{label}</p>
        <h3 className="text-white text-xl font-bold tracking-tight whitespace-nowrap group-hover:text-primary transition-colors">
          {value}
        </h3>
      </div>
    </div>
  );
};

export default StatCard;

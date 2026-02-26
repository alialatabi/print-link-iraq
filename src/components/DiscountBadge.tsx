import React from 'react';

interface DiscountBadgeProps {
  percentage: number;
}

const DiscountBadge: React.FC<DiscountBadgeProps> = ({ percentage }) => {
  if (!percentage || percentage <= 0) return null;

  return (
    <div className="absolute top-0 right-0 z-10">
      {/* White cutout corner shape */}
      <div className="relative bg-white text-destructive font-black text-xs sm:text-sm px-3 py-1.5 rounded-bl-2xl rounded-tr-2xl shadow-md">
        <span className="leading-none">خصم {percentage}%</span>
      </div>
    </div>
  );
};

export default DiscountBadge;

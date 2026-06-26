interface IconDisplayProps {
  icon: string;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

const IconDisplay = ({ icon, iconUrl, size = 'md' }: IconDisplayProps) => {
  const sizeClasses = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-14 h-14' };
  const textSizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' };

  if (iconUrl) {
    return <img src={iconUrl} alt="" className={`${sizeClasses[size]} rounded-lg object-cover`} />;
  }
  return <span className={textSizes[size]}>{icon}</span>;
};

export default IconDisplay;

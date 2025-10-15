import { BtnBgShadow } from './btn-bg-shadow';

export const Button = ({
  btn_color = 'purple',
  btn_style = 'square_rounded',
  btn_type = 'button',
  placeholder,
  className = '',
  icon_comp,
  orientation = 'ImageText',
  onClick,
  disabled = false,
}) => {
  // Map button styles to the appropriate Tailwind classes
  const bgColors = {
    green: 'bg-[#55d355] hover:bg-[#4fc04f]',
    yellow: 'bg-[#ffd500] hover:bg-[#fcdb38]',
    blue: 'bg-[#2563eb] hover:bg-[#1549b9]',
    purple: 'bg-[#8b3ecf] hover:bg-[#7e39bb]',
    red: 'bg-[#d00000] hover:bg-[#b40202]',
  };

  const borderRadiusStyles = {
    square: 'rounded-none',
    square_rounded: 'rounded-[4px]',
    circle: 'rounded-full',
  };

  // Determine text color based on button style
  const textColor =
    btn_color === 'blue' || btn_color === 'purple' || btn_color === 'red'
      ? 'text-yellow-300'
      : 'text-foreground';

  // Map button style to appropriate border radius for BgShadow
  const BtnBgShadowRadius = {
    square: '0',
    square_rounded: '4',
    circle: '100',
  };

  return (
    <div className="relative">
      <BtnBgShadow borderRadius={BtnBgShadowRadius[btn_style]} />
      <button
        onClick={onClick}
        type={btn_type}
        disabled={disabled}
        className={`${bgColors[btn_color]} ${borderRadiusStyles[btn_style]} relative z-10 flex w-full cursor-pointer items-center justify-center gap-1 border-[3px] border-gray-900 px-4 py-1 font-bold transition-all outline-none hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] disabled:opacity-50 disabled:cursor-not-allowed ${textColor} ${className}`}
      >
        {orientation === 'TextImage' ? (
          <>
            {placeholder}
            {icon_comp}
          </>
        ) : (
          <>
            {icon_comp}
            {placeholder}
          </>
        )}
      </button>
    </div>
  );
};

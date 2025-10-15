import { BtnBgShadow } from '../buttons/btn-bg-shadow';

export const Cards = ({
  card_style = 'square_rounded',
  children,
  className = '',
  isPinned = false,
}) => {
  // Map card styles to the appropriate Tailwind classes
  const borderRadiusStyles = {
    square: 'rounded-none',
    square_rounded: 'rounded-[4px]',
    circle: 'rounded-full',
  };

  const borderWidthStyles = {
    square: 'border-4',
    square_rounded: 'border-[3px]',
    circle: 'border-2',
  };

  const shadowBorderRadius = {
    square: '0',
    square_rounded: '4',
    circle: '100',
  };

  return (
    <div className="relative w-full">
      <div
        className="absolute inset-0 translate-x-[3px] translate-y-[3px] bg-black rounded-[4px]"
      />
      <div
        className={`${className} ${borderRadiusStyles[card_style]} ${borderWidthStyles[card_style]} bg-[#89ddd6] relative z-10 w-full border-gray-900 font-bold outline-none translate-x-0 translate-y-0`}
      >
        {children}
      </div>
    </div>
  );
};

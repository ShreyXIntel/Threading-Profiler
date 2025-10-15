import { BtnBgShadow } from '../buttons/btn-bg-shadow';

export const Input = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  className = '',
  input_style = 'square_rounded',
  accept,
  multiple = false,
  disabled = false,
}) => {
  const borderRadiusStyles = {
    square: 'rounded-none',
    square_rounded: 'rounded-[4px]',
    circle: 'rounded-full',
  };

  // Map input style to appropriate border radius for BgShadow
  const BtnBgShadowRadius = {
    square: '0',
    square_rounded: '4',
    circle: '100',
  };

  return (
    <div className="relative">
      <BtnBgShadow borderRadius={BtnBgShadowRadius[input_style]} />
      <input
        type={type}
        value={value}
        onChange={onChange}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className={`${className} ${borderRadiusStyles[input_style]} relative z-20 w-full border-[3px] border-gray-900 bg-white px-4 py-3 font-bold outline-none hover:-translate-x-[1px] hover:-translate-y-[1px] focus:translate-x-[1.5px] focus:translate-y-[1.5px] disabled:opacity-50 disabled:cursor-not-allowed`}
        placeholder={placeholder}
      />
    </div>
  );
};

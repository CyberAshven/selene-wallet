interface CheckboxProps {
  checked: boolean;
  onChange: (event) => void;
  disabled?: boolean;
}

export default function Checkbox({
  checked,
  onChange,
  disabled = false,
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

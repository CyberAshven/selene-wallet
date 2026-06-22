import { useState } from "react";
import { CheckCircleFilled, EditOutlined } from "@ant-design/icons";

interface EditableProps {
  value: string;
  onConfirm: (string) => void;
  onChange?: (string) => void;
  onBlur?: (string) => void;
  onFocus?: (string) => void;
  open?: boolean;
  showConfirm?: boolean;
  placeholder?: string;
  invalid?: boolean;
  confirmOnBlur?: boolean;
}

export default function Editable({
  value,
  onConfirm,
  onChange = () => {},
  onBlur = () => {},
  onFocus = () => {},
  open = false,
  showConfirm = true,
  placeholder = "",
  invalid = false,
  confirmOnBlur = false,
}: EditableProps) {
  const [input, setInput] = useState("");
  const [isEditing, setIsEditing] = useState(open);
  const [isInputConfirmed, setIsInputConfirmed] = useState(false);
  const [isInputDirty, setIsInputDirty] = useState(false);

  const handleInputChange = (event) => {
    const { value: val } = event.target;

    setIsInputDirty(true);
    setIsInputConfirmed(false);
    setInput(val);
    onChange(val);
  };

  const handleEdit = async () => {
    if (isEditing === true) {
      await onConfirm(input);
      setIsEditing(false);
      setIsInputConfirmed(true);
      setIsInputDirty(false);
    } else {
      setIsEditing(true);

      if (!isInputDirty) {
        setInput(value);
      }
    }
  };

  const handleBlur = async () => {
    await onBlur(input);

    if (confirmOnBlur) {
      handleEdit();
    }
  };

  const handleFocus = async () => {
    await onFocus(input);
  };

  const borderColor = invalid
    ? "border-error/90"
    : "border-primary/80 dark:border-primarydark-400";

  return isEditing ? (
    <div className="flex items-center">
      <input
        type="text"
        data-testid="editable-input"
        className={`rounded-lg bg-white dark:bg-neutral-500 text-primary dark:text-neutral-25 p-1 w-full text-center border-2 ${borderColor}`}
        onChange={handleInputChange}
        onKeyDown={(e) => e.key === "Enter" && handleEdit()}
        onBlur={handleBlur}
        onFocus={handleFocus}
        value={
          input === value || (input === "" && !isInputDirty) ? value : input
        }
      />
    </div>
  ) : (
    <div className="flex items-center gap-x-1" onClick={handleEdit}>
      <span className="text-center">{value || placeholder}</span>
      {showConfirm && (
        <span className="flex items-center justify-center opacity-90">
          {isInputConfirmed ? (
            <CheckCircleFilled className="text-base text-primary" />
          ) : (
            <EditOutlined className="text-2xl" onClick={handleEdit} />
          )}
        </span>
      )}
    </div>
  );
}

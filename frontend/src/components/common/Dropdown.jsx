import { useState } from "react";

export default function Dropdown({
  trigger,
  children,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="dropdown">
      <div
        onClick={() =>
          setOpen((value) => !value)
        }
      >
        {trigger}
      </div>

      {open && (
        <div className="dropdown-menu">
          {children}
        </div>
      )}
    </div>
  );
}
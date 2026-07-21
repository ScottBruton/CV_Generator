export default function AutoTextarea({ value, onChange, className, ...rest }) {
  return (
    <div className="shell-grow-wrap" data-replicated-value={value ?? ''}>
      <textarea
        {...rest}
        className={className ? `shell-textarea-auto ${className}` : 'shell-textarea-auto'}
        value={value}
        rows={1}
        onChange={onChange}
      />
    </div>
  );
}

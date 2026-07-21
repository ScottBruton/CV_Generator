export default function DocTabs({ labels, activeDoc, onChange }) {
  const tabs = [
    { id: 'cover', label: labels?.cover || 'Cover Letter' },
    { id: 'cv', label: labels?.cv || 'CV' },
    { id: 'portfolio', label: labels?.portfolio || 'Portfolio' }
  ];

  return (
    <div className="shell-tabs" role="tablist" aria-label="Documents">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeDoc === tab.id}
          className={`shell-tab${activeDoc === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

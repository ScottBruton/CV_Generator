import { getWordDiffParts } from '../../ai/diffGroups.js';

export default function DiffText({ originalText, proposedText, mode = 'proposed' }) {
  if (mode === 'original') {
    const parts = getWordDiffParts(originalText, proposedText);
    return (
      <span className="ai-diff">
        {parts.map((part, index) => {
          if (part.added) return null;
          if (part.removed) {
            return <del key={index} className="ai-diff__del">{part.value}</del>;
          }
          return <span key={index}>{part.value}</span>;
        })}
      </span>
    );
  }

  const parts = getWordDiffParts(originalText, proposedText);
  return (
    <span className="ai-diff">
      {parts.map((part, index) => {
        if (part.removed) {
          return <del key={index} className="ai-diff__del ai-diff__del--subtle">{part.value}</del>;
        }
        if (part.added) {
          return <ins key={index} className="ai-diff__ins">{part.value}</ins>;
        }
        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
}

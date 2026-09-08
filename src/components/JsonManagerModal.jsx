import React, { useState } from 'react';
import { X, Upload, Download, RefreshCw, Check, AlertCircle, FileCode } from 'lucide-react';

export default function JsonManagerModal({
  currentQuestionsJson, // JS object or raw string
  onSaveQuestions,
  onClose
}) {
  const [jsonText, setJsonText] = useState(
    typeof currentQuestionsJson === 'string'
      ? currentQuestionsJson
      : JSON.stringify(currentQuestionsJson, null, 2)
  );

  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleValidateAndSave = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.questions) throw new Error("JSON must contain a 'questions' object.");
      if (!parsed.questions.teamA || !parsed.questions.teamA.easy || !parsed.questions.teamA.medium || !parsed.questions.teamA.hard) {
        throw new Error("JSON must contain 'questions.teamA' with 'easy', 'medium', 'hard' arrays.");
      }
      if (!parsed.questions.teamB || !parsed.questions.teamB.easy || !parsed.questions.teamB.medium || !parsed.questions.teamB.hard) {
        throw new Error("JSON must contain 'questions.teamB' with 'easy', 'medium', 'hard' arrays.");
      }
      if (!parsed.questions.challenge_upgrades) {
        throw new Error("JSON must contain 'questions.challenge_upgrades' with 'medium', 'hard', 'very_hard' arrays.");
      }
      if (!parsed.questions.tiebreaker || parsed.questions.tiebreaker.length < 5) {
        throw new Error("JSON must contain 'questions.tiebreaker' array with at least 5 questions.");
      }
      setErrorMsg(null);
      setSuccessMsg("JSON validated successfully!");
      onSaveQuestions(parsed);
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMsg(`Invalid JSON: ${err.message}`);
      setSuccessMsg(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = JSON.parse(content);
        setJsonText(JSON.stringify(parsed, null, 2));
        setErrorMsg(null);
        setSuccessMsg(`Successfully loaded ${file.name}`);
      } catch (err) {
        setErrorMsg(`Failed to parse uploaded JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tug_of_war_questions.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="json-modal-card">
        <div className="modal-header">
          <div className="title-box">
            <FileCode size={24} className="icon-blue" />
            <h2>QUESTIONS JSON MANAGER</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            View, edit, or upload your custom questions JSON. Round 2 structure requires <code>teamA</code>, <code>teamB</code>, <code>challenge_upgrades</code>, and <code>tiebreaker</code> sections.
          </p>

          {errorMsg && (
            <div className="alert-box alert-error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="alert-box alert-success">
              <Check size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="json-editor-wrapper">
            <textarea
              className="json-textarea"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder="Paste JSON here..."
              rows={16}
            />
          </div>
        </div>

        <div className="modal-footer">
          <div className="file-actions">
            <label className="btn-upload-label">
              <Upload size={16} />
              Upload JSON File
              <input 
                type="file" 
                accept=".json" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
            </label>

            <button className="btn-secondary" onClick={handleDownloadJson}>
              <Download size={16} />
              Export JSON
            </button>
          </div>

          <div className="save-actions">
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" onClick={handleValidateAndSave}>
              <Check size={16} />
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

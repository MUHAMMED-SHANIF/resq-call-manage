import React, { useState, useRef } from 'react';
import { Upload, AlertTriangle, FileSpreadsheet } from 'lucide-react';

export default function Dropzone({ onFileLoaded, onError, errorMessage }) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    const isExcel = ['xlsx', 'xlsb', 'xls'].includes(extension);
    const isCsv = extension === 'csv';

    if (!isExcel && !isCsv) {
      onError('Invalid file format. Please upload an Excel file (.xlsx, .xlsb, .xls) or a CSV file (.csv).');
      return;
    }

    onError(null); // Clear errors

    if (isCsv) {
      // Read CSV as text
      const reader = new FileReader();
      reader.onload = (e) => {
        onFileLoaded(e.target.result, file.name, 'csv');
      };
      reader.onerror = () => {
        onError('Failed to read the CSV file. It might be corrupted or open in another application.');
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      // Read Excel as ArrayBuffer
      const reader = new FileReader();
      reader.onload = (e) => {
        onFileLoaded(e.target.result, file.name, 'excel');
      };
      reader.onerror = () => {
        onError('Failed to read the file. It might be corrupted or open in another application.');
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div style={{ maxWidth: '600px', width: '100%', margin: '0 auto' }}>
      <div 
        className={`upload-container ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          id="excel-file-input" 
          accept=".xlsx,.xlsb,.xls,.csv" 
          style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0, opacity: 0 }}
          onChange={handleChange}
        />
        
        <div className="upload-icon-wrapper">
          <Upload size={32} />
        </div>
        
        <h3 className="upload-title">Upload Excel or CSV Database</h3>
        <p className="upload-subtitle">
          Drag and drop your <strong>.xlsx</strong>, <strong>.xlsb</strong>, or <strong>.csv</strong> file here, or click to browse files
        </p>
        
        <button type="button" className="btn btn-secondary">
          Select File
        </button>
      </div>

      {errorMessage && (
        <div className="error-toast">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

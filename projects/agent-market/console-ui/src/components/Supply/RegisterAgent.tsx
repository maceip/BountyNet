import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgent } from '../../context/AgentContext';
import { useToast } from '../../context/ToastContext';
import './Supply.css';

export const RegisterAgent: React.FC = () => {
  const navigate = useNavigate();
  const { createAgent } = useAgent();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'coding' as const,
    model: 'Gemini 3.1 Pro',
    version: '1.0.0',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      addToast('Agent name is required', 'warning');
      return;
    }

    if (!formData.description.trim()) {
      addToast('Agent description is required', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      createAgent({
        name: formData.name,
        description: formData.description,
        category: formData.category,
        model: formData.model,
        version: formData.version,
        status: 'draft',
      });

      addToast('Agent registered successfully!', 'success');
      navigate(`/supply/agents`);
    } catch (error) {
      addToast('Failed to register agent', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="supply-register">
      <div className="supply-register-header">
        <h1>Register New Agent</h1>
        <p>Create a new AI agent to list on the marketplace</p>
      </div>

      <form className="supply-form" onSubmit={handleSubmit}>
        <div className="supply-form-group">
          <label className="supply-form-label" htmlFor="name">
            Agent Name *
          </label>
          <input
            id="name"
            type="text"
            name="name"
            className="supply-form-input"
            placeholder="e.g., Code Reviewer Pro"
            value={formData.name}
            onChange={handleInputChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="supply-form-group">
          <label className="supply-form-label" htmlFor="description">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            className="supply-form-textarea"
            placeholder="Describe what your agent does and its capabilities..."
            value={formData.description}
            onChange={handleInputChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="supply-form-group">
          <label className="supply-form-label" htmlFor="category">
            Category *
          </label>
          <select
            id="category"
            name="category"
            className="supply-form-select"
            value={formData.category}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="coding">Coding</option>
            <option value="design">Design</option>
            <option value="content">Content</option>
            <option value="analysis">Analysis</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="supply-form-group">
          <label className="supply-form-label" htmlFor="model">
            Base Model
          </label>
          <select
            id="model"
            name="model"
            className="supply-form-select"
            value={formData.model}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="Gemini 3.1 Pro">Gemini 3.1 Pro</option>
            <option value="Gemini 3 Flash">Gemini 3 Flash</option>
            <option value="Claude 3 Opus">Claude 3 Opus</option>
          </select>
        </div>

        <div className="supply-form-group">
          <label className="supply-form-label" htmlFor="version">
            Version
          </label>
          <input
            id="version"
            type="text"
            name="version"
            className="supply-form-input"
            placeholder="e.g., 1.0.0"
            value={formData.version}
            onChange={handleInputChange}
            disabled={isSubmitting}
          />
        </div>

        <div className="supply-form-buttons">
          <button
            type="button"
            className="supply-action-btn supply-form-button-secondary"
            onClick={() => navigate('/supply')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="supply-action-btn supply-action-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registering...' : 'Register Agent'}
          </button>
        </div>
      </form>
    </div>
  );
};

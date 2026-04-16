import React from 'react';
import './Legal.css';

interface License {
  name: string;
  version: string;
  license: string;
  link: string;
}

export const LicensesPage: React.FC = () => {
  const licenses: License[] = [
    {
      name: 'React',
      version: '19.0.0',
      license: 'MIT',
      link: 'https://github.com/facebook/react/blob/main/LICENSE'
    },
    {
      name: 'React Router DOM',
      version: '6.x',
      license: 'MIT',
      link: 'https://github.com/remix-run/react-router/blob/main/LICENSE.md'
    },
    {
      name: 'Vite',
      version: '5.x',
      license: 'MIT',
      link: 'https://github.com/vitejs/vite/blob/main/LICENSE'
    },
    {
      name: 'TypeScript',
      version: '5.x',
      license: 'Apache 2.0',
      link: 'https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt'
    }
  ];

  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Open Source Licenses</h1>
        
        <p className="licenses-intro">
          Jules is built on the shoulders of giants. This page lists the open source projects and licenses that make Jules possible.
        </p>

        <div className="licenses-list">
          {licenses.map((license) => (
            <div key={license.name} className="license-card">
              <div className="license-header">
                <h3>{license.name}</h3>
                <span className="license-badge">{license.license}</span>
              </div>
              <p className="license-version">Version: {license.version}</p>
              <a
                href={license.link}
                target="_blank"
                rel="noopener noreferrer"
                className="license-link"
              >
                View full license
              </a>
            </div>
          ))}
        </div>

        <section className="mit-license">
          <h2>MIT License Summary</h2>
          <p>
            The MIT License is one of the most permissive open source licenses. It allows you to use, modify, and distribute the software freely, as long as you include the original copyright notice and license.
          </p>
        </section>
      </div>
    </div>
  );
};

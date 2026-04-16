import React from 'react';
import './Legal.css';

export const LegalPage: React.FC = () => {
  return (
    <div className="legal-page">
      <div className="legal-container">
        <h1>Terms of Service</h1>
        
        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Jules, you accept and agree to be bound by the terms and provision of this agreement.
          </p>
        </section>

        <section>
          <h2>2. License Grant</h2>
          <p>
            Jules grants you a limited, non-exclusive, non-transferable, revocable license to use the service in accordance with these terms.
          </p>
        </section>

        <section>
          <h2>3. User Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account and password and for all activities that occur under your account. You agree to notify Jules immediately of any unauthorized use of your account.
          </p>
        </section>

        <section>
          <h2>4. Intellectual Property Rights</h2>
          <p>
            Jules and its original content, features, and functionality are owned by Google Labs, its licensors, or other providers of such material. All content is protected by United States and international copyright, trademark, and other intellectual property laws.
          </p>
        </section>

        <section>
          <h2>5. Limitation of Liability</h2>
          <p>
            In no event shall Jules, nor its directors, employees, or agents, be liable to you for anything arising out of or in any way connected with your use of this service.
          </p>
        </section>

        <section>
          <h2>6. Termination</h2>
          <p>
            Jules may terminate or suspend your account and right to use the service immediately, without prior notice or liability, for any reason whatsoever.
          </p>
        </section>

        <section>
          <h2>7. Governing Law</h2>
          <p>
            These terms and conditions are governed by and construed in accordance with the laws of the United States, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>
      </div>
    </div>
  );
};

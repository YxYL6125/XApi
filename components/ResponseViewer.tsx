
import React, { useState } from 'react';
import { HttpResponse, ExpectedResponse } from '../types';
import { formatBytes } from '../utils';

interface ResponseViewerProps {
  response: HttpResponse | null;
  error?: string | null;
  expectedResponse?: ExpectedResponse;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ response, error, expectedResponse }) => {
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'expected'>('body');

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 400) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return (
      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );
    if (status >= 400) return (
      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );
    return (
      <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header: Tabs + Status */}
      <div className="flex justify-between items-center border-b border-gray-200 px-2 mt-1 min-h-[33px]">
        {/* Left: Tabs */}
        <div className="flex">
          <button
            onClick={() => setActiveTab('body')}
            className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition-colors mb-[-1px] ${activeTab === 'body'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            BODY
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition-colors mb-[-1px] ${activeTab === 'headers'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            HEADERS
          </button>
          {expectedResponse && (
            <button
              onClick={() => setActiveTab('expected')}
              className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition-colors mb-[-1px] flex items-center ${activeTab === 'expected'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
              EXPECTED
            </button>
          )}
        </div>

        {/* Right: Status Metrics */}
        {response && (
          <div className="flex items-center text-xs space-x-3 pb-1 mr-2 select-text">
            <div className={`flex items-center font-bold ${getStatusColor(response.status)}`}>
              {getStatusIcon(response.status)}
              <span>{response.status} {response.statusText}</span>
            </div>

            <div className="text-gray-300">|</div>

            <div className="text-gray-600 flex items-center">
              <span className="font-medium mr-1">{response.time}</span> ms
            </div>

            <div className="text-gray-300">|</div>

            <div className="text-gray-600 flex items-center">
              <span className="font-medium mr-1">{formatBytes(response.size)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 bg-white relative">
        {error && (
          <div className="flex items-center justify-center h-full text-red-600 p-4">
            <div className="text-center">
              <div className="text-lg font-bold mb-1">Request Failed</div>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!response && !error && activeTab !== 'expected' && (
          <div className="flex items-center justify-center h-full text-gray-300 text-sm italic">
            Send a request to see the response
          </div>
        )}

        {response && !error && activeTab === 'body' && (
          <ResponseContent body={response.body} />
        )}

        {response && !error && activeTab === 'headers' && (
          <div className="space-y-0.5">
            {Object.entries(response.headers).map(([key, val]) => (
              <div key={key} className="grid grid-cols-[120px_1fr] gap-2 text-xs py-1 border-b border-gray-50 hover:bg-gray-50">
                <div className="font-semibold text-gray-700 truncate select-text" title={key}>{key}</div>
                <div className="text-gray-600 break-all select-text font-mono">{val}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'expected' && expectedResponse && (
          <ExpectedResponseContent expectedResponse={expectedResponse} />
        )}
      </div>
    </div>
  );
};

const ResponseContent = ({ body }: { body: string }) => {
  const content = React.useMemo(() => {
    try {
      const json = JSON.parse(body);
      return JSON.stringify(json, null, 2);
    } catch {
      return body;
    }
  }, [body]);

  return (
    <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto h-full select-text">
      {content}
    </pre>
  );
};

const ExpectedResponseContent = ({ expectedResponse }: { expectedResponse: ExpectedResponse }) => {
  return (
    <div className="space-y-4">
      {/* Status and Description */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded mr-2">
              {expectedResponse.status}
            </span>
            <span className="text-sm text-orange-800">Expected Response (from Swagger)</span>
          </div>
        </div>
        {expectedResponse.description && (
          <p className="text-xs text-orange-700 mt-2">{expectedResponse.description}</p>
        )}
      </div>

      {/* Example Response */}
      {expectedResponse.example && (
        <div>
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
            Example Response Body
          </div>
          <pre className="text-xs font-mono text-gray-800 whitespace-pre-wrap overflow-x-auto bg-gray-50 border border-gray-200 rounded-lg p-3 select-text">
            {expectedResponse.example}
          </pre>
        </div>
      )}

      {/* Schema (collapsed by default) */}
      {expectedResponse.schema && (
        <details className="group">
          <summary className="text-xs font-bold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 flex items-center">
            <svg className="w-3 h-3 mr-1 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            JSON Schema
          </summary>
          <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap overflow-x-auto bg-gray-50 border border-gray-200 rounded-lg p-3 mt-2 select-text">
            {JSON.stringify(expectedResponse.schema, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};

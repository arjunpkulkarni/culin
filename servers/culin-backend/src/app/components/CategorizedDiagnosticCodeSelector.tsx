'use client'

import { useState, useEffect } from 'react';
import axios from 'axios';

interface DiagnosticCode {
  code: string;
  name: string;
}

interface CategorizedCodes {
  [category: string]: DiagnosticCode[];
}

interface CategorizedDiagnosticCodeSelectorProps {
  onToggle: (code: DiagnosticCode) => void;
  selectedCodes: DiagnosticCode[];
}

export default function CategorizedDiagnosticCodeSelector({ onToggle, selectedCodes }: CategorizedDiagnosticCodeSelectorProps) {
  const [categorizedCodes, setCategorizedCodes] = useState<CategorizedCodes>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCodes = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/all-diagnostic-codes');
        setCategorizedCodes(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to load diagnostic codes.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCodes();
  }, []);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setSearchTerm('');
  };

  const codesToFilter = selectedCategory
    ? categorizedCodes[selectedCategory] || []
    : Object.values(categorizedCodes).flat();

  const filteredCodes = searchTerm
    ? codesToFilter.filter(
        code =>
          code.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          code.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : selectedCategory
    ? codesToFilter // Show all codes in category if no search term
    : []; // Show no codes if no category and no search term

  if (loading) return <div className="text-center p-4">Loading codes...</div>;
  if (error) return <div className="text-center p-4 text-red-500">{error}</div>;

  return (
    <div className="border border-gray-300 rounded-lg p-4 bg-white shadow-sm">
      <input
        type="text"
        placeholder={selectedCategory ? `Search within ${selectedCategory}...` : "Search all diagnostic codes..."}
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
      />

      {/* Show search results if there's a search term */}
      {searchTerm ? (
        <div className="max-h-60 overflow-auto">
          {filteredCodes.map(code => (
            <div
              key={code.code}
              onClick={() => onToggle(code)}
              className="flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded-md"
            >
              <input
                type="checkbox"
                checked={!!selectedCodes.find(c => c.code === code.code)}
                readOnly
                className="mr-2"
              />
              <div>
                <div className="font-medium text-gray-800">{code.code}</div>
                <div className="text-sm text-gray-600">{code.name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : selectedCategory ? (
        // If a category is selected and no search term, show the items in the category
        <div>
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-indigo-600 hover:underline"
            >
              &larr; Back to Categories
            </button>
            <h3 className="text-lg font-semibold">{selectedCategory}</h3>
          </div>
          <div className="max-h-60 overflow-auto">
            {filteredCodes.map(code => (
              <div
                key={code.code}
                onClick={() => onToggle(code)}
                className="flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded-md"
              >
                <input
                  type="checkbox"
                  checked={!!selectedCodes.find(c => c.code === code.code)}
                  readOnly
                  className="mr-2"
                />
                <div>
                  <div className="font-medium text-gray-800">{code.code}</div>
                  <div className="text-sm text-gray-600">{code.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // If no search term and no category, show the category grid
        <div className="grid grid-cols-4 gap-2">
          {Object.keys(categorizedCodes).sort().map(category => (
            <button
              key={category}
              onClick={() => handleSelectCategory(category)}
              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-md text-sm"
            >
              {category}
            </button>
          ))}
        </div>
      )}
    </div>
  );
} 
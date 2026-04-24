import React, { useState } from "react";
import { toast } from "sonner";

const DetailsSection = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    institution: "",
    researchInterest: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fullName || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    toast.success("Research collaboration request submitted successfully!");
    setFormData({
      fullName: "",
      email: "",
      institution: "",
      researchInterest: ""
    });
  };

  return (
    <section id="details" className="w-full bg-white py-0">
      <div className="container px-4 sm:px-6 lg:px-8 mx-auto">
        <div className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-2">
          {/* Left Card - Research Framework */}
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-elegant">
            <div className="relative h-48 sm:h-64 p-6 sm:p-8 flex items-end bg-gradient-to-br from-culinary-500 to-medical-600">
              <h2 className="text-2xl sm:text-3xl font-display text-white font-bold">
                Research Framework
              </h2>
            </div>
            
            <div className="bg-white p-4 sm:p-8 border border-gray-100">
              <h3 className="text-lg sm:text-xl font-display mb-6 sm:mb-8">
                3-Phase Implementation
              </h3>

              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-culinary-500 flex items-center justify-center mt-1 flex-shrink-0 text-white text-xs font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <div className="p-3 rounded-lg bg-culinary-50/80 backdrop-blur-sm border border-culinary-100">
                      <span className="font-semibold text-base text-culinary-700">Phase 1:</span> Basic EMR integration + Nutritionist recommendations
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-medical-500 flex items-center justify-center mt-1 flex-shrink-0 text-white text-xs font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <div className="p-3 rounded-lg bg-medical-50/80 backdrop-blur-sm border border-medical-100">
                      <span className="font-semibold text-base text-medical-700">Phase 2:</span> Clinical data + Lab results + AI recipe generation
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center mt-1 flex-shrink-0 text-white text-xs font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <div className="p-3 rounded-lg bg-gray-50/80 backdrop-blur-sm border border-gray-100">
                      <span className="font-semibold text-base">Phase 3:</span> Genomics + Proteomics + Microbiome + Full autonomy
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-culinary-50 to-medical-50 rounded-lg border border-culinary-200">
                  <h4 className="font-semibold text-culinary-700 mb-2">Target Conditions</h4>
                  <p className="text-sm text-gray-600">Diabetes, Hypertension, Heart Failure, Cancer, Post-surgical Recovery, Bariatric Surgery, Mental Health</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Card - Research Collaboration */}
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-elegant">
            <div className="relative h-48 sm:h-64 p-6 sm:p-8 flex flex-col items-start bg-gradient-to-br from-medical-500 to-culinary-600">
              <div className="inline-block px-4 sm:px-6 py-2 border border-white text-white rounded-full text-xs mb-4">
                Research Partnership
              </div>
              <h2 className="text-2xl sm:text-3xl font-display text-white font-bold mt-auto">
                Join Our Research
              </h2>
            </div>
            
            <div className="bg-white p-4 sm:p-8 border border-gray-100">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                <div>
                  <input 
                    type="text" 
                    name="fullName" 
                    value={formData.fullName} 
                    onChange={handleChange} 
                    placeholder="Full name *" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-culinary-500 focus:border-transparent" 
                    required 
                  />
                </div>
                
                <div>
                  <input 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    placeholder="Email address *" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-culinary-500 focus:border-transparent" 
                    required 
                  />
                </div>
                
                <div>
                  <input 
                    type="text" 
                    name="institution" 
                    value={formData.institution} 
                    onChange={handleChange} 
                    placeholder="Institution/Hospital" 
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-culinary-500 focus:border-transparent" 
                  />
                </div>

                <div>
                  <select 
                    name="researchInterest" 
                    value={formData.researchInterest} 
                    onChange={handleChange} 
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-culinary-500 focus:border-transparent bg-white"
                  >
                    <option value="">Research Interest</option>
                    <option value="genomics">Genomics & Personalized Nutrition</option>
                    <option value="clinical">Clinical Integration & EMR</option>
                    <option value="ai">AI Recipe Generation</option>
                    <option value="outcomes">Patient Outcomes Research</option>
                    <option value="grant">Grant Collaboration</option>
                  </select>
                </div>
                
                <div>
                  <button 
                    type="submit" 
                    className="w-full px-6 py-3 bg-gradient-to-r from-culinary-500 to-medical-500 hover:from-culinary-600 hover:to-medical-600 text-white font-medium rounded-full transition-colors duration-300"
                  >
                    Join Research Network
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DetailsSection; 
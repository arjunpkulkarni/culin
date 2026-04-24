import React, { useEffect, useRef, useState } from "react";

const SpecsSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    
    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    
    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section className="w-full py-8 sm:py-12 bg-gradient-to-br from-gray-50 to-white relative overflow-hidden" id="partnership" ref={sectionRef}>
      {/* Animated background elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-culinary-100/20 rounded-full blur-2xl animate-[float_6s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-1/3 right-1/3 w-24 h-24 bg-medical-100/30 rounded-full blur-xl animate-[float_4s_ease-in-out_infinite_2s]"></div>
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 mx-auto relative z-10">
        {/* Enhanced header with staggered animations */}
        <div className="flex items-center gap-4 mb-8 sm:mb-16">
          <div className="flex items-center gap-4">
            <div className={`culinary-chip transition-all duration-700 ${isVisible ? 'animate-[slideInLeft_0.6s_ease-out]' : 'opacity-0 -translate-x-10'}`}>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-culinary-500 text-white mr-2 font-bold text-xs">
                ∞
              </span>
              <span>Partnership Opportunity</span>
            </div>
          </div>
          <div className={`flex-1 h-[2px] bg-gradient-to-r from-culinary-500 to-medical-500 transition-all duration-1000 ${isVisible ? 'animate-[grow_1s_ease-out_0.3s_both]' : 'scale-x-0'}`}></div>
        </div>
        
        {/* Main content with enhanced typography and animations */}
        <div className="max-w-6xl pl-4 sm:pl-8">
          <h2 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl leading-tight mb-8 sm:mb-12 transition-all duration-1000 ${isVisible ? 'animate-[fadeInUp_0.8s_ease-out_0.5s_both]' : 'opacity-0 translate-y-10'}`}>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-culinary-600 to-medical-600 animate-[gradientShift_3s_ease-in-out_infinite]">
              Culin is revolutionizing how hospitals deliver personalized nutrition care through breakthrough 
              AI technology that analyzes patient genetics, clinical data, and real-time biomarkers to create 
              therapeutic nutrition protocols that dramatically improve patient outcomes and accelerate recovery times.
            </span>
          </h2>

          {/* Partnership benefits grid */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 transition-all duration-1000 ${isVisible ? 'animate-[fadeInUp_0.8s_ease-out_0.8s_both]' : 'opacity-0 translate-y-10'}`}>
            <div className="group p-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-culinary-100 hover:border-culinary-300 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-br from-culinary-500 to-culinary-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Revolutionary Technology</h3>
              <p className="text-gray-600 text-sm">First-ever genomics-integrated nutrition AI platform</p>
            </div>

            <div className="group p-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-medical-100 hover:border-medical-300 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-br from-medical-500 to-medical-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Patient-First Impact</h3>
              <p className="text-gray-600 text-sm">Transforming patient recovery and quality of life</p>
            </div>

            <div className="group p-6 bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-100 hover:border-gray-300 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Partnership Ready</h3>
              <p className="text-gray-600 text-sm">Seeking visionary healthcare partners to scale globally</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpecsSection;
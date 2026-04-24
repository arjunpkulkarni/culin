import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import techImage from "@/pictures/tech.png";

const HumanIntuitionSection = () => {
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
    <section className="py-16 bg-gradient-to-br from-gray-50 via-culinary-50/30 to-medical-50/30 relative overflow-hidden" id="revolution" ref={sectionRef}>
      {/* Enhanced floating background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 right-1/4 w-40 h-40 bg-culinary-100/20 rounded-full blur-3xl animate-[float_12s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-1/3 left-1/4 w-32 h-32 bg-medical-100/25 rounded-full blur-2xl animate-[float_10s_ease-in-out_infinite_2s]"></div>
        <div className="absolute top-1/2 left-1/2 w-24 h-24 bg-gray-200/30 rounded-full blur-xl animate-[float_8s_ease-in-out_infinite_1s]"></div>
      </div>

      <div className="section-container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="text-left">
            <div className={`culinary-chip mb-4 transition-all duration-700 ${isVisible ? 'animate-[slideInLeft_1.2s_ease-out]' : 'opacity-0 -translate-x-10'}`}>
              <span>Revolutionary Innovation</span>
            </div>
            
            <h2 className={`section-title mb-6 transition-all duration-1000 ${isVisible ? 'animate-[fadeInUp_1.5s_ease-out_0.2s_both]' : 'opacity-0 translate-y-10'}`}>
              Pioneering the Future of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-culinary-500 to-medical-500">
                Patient-Centered Care
              </span>
            </h2>
            
            <p className={`text-lg text-gray-700 mb-8 transition-all duration-1000 ${isVisible ? 'animate-[fadeInUp_1.5s_ease-out_0.4s_both]' : 'opacity-0 translate-y-10'}`}>
              Culin represents a paradigm shift in healthcare technology. We're developing the world's first 
              comprehensive AI platform that combines genomics, clinical intelligence, and precision nutrition 
              to create truly personalized patient care experiences.
            </p>
            
            <div className="space-y-6">
              {[
                {
                  title: "Genomic-Powered Personalization",
                  description: "Revolutionary AI that analyzes genetic markers to create nutrition interventions tailored to each patient's unique biological profile.",
                  delay: "0.6s"
                },
                {
                  title: "Partnership-Ready Platform", 
                  description: "Built for seamless integration with healthcare systems. We're actively seeking visionary partners to transform patient outcomes together.",
                  delay: "0.8s"
                },
                {
                  title: "Patient-First Innovation",
                  description: "Every algorithm, every decision, every breakthrough is designed around one goal: dramatically improving patient health and recovery outcomes.",
                  delay: "1.0s"
                },
                {
                  title: "The Future is Now",
                  description: "Join us in creating the next generation of healthcare. Culin isn't just a product—it's a movement toward truly personalized medicine.",
                  delay: "1.2s"
                }
              ].map((item, index) => (
                <div 
                  key={index} 
                  className={`flex items-start group transition-all duration-1000 ${isVisible ? 'animate-[fadeInUp_1.5s_ease-out_both] opacity-100' : 'opacity-0 translate-y-10'}`}
                  style={{ animationDelay: item.delay }}
                >
                  <div className="mr-4 mt-1">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-culinary-500 to-medical-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-culinary-600 transition-colors duration-300">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className={`relative transition-all duration-1000 ${isVisible ? 'animate-[fadeInRight_1.5s_ease-out_0.4s_both]' : 'opacity-0 translate-x-10'}`}>
            <div className="relative overflow-hidden rounded-3xl shadow-2xl group hover:shadow-3xl transition-all duration-500">
              <Image 
                src={techImage}
                alt="Revolutionary Healthcare Innovation" 
                className="w-full h-auto group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-culinary-900/30 to-transparent"></div>
              
              {/* Enhanced floating elements */}
              <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md rounded-xl p-4 border border-white/20 animate-[float_6s_ease-in-out_infinite] hover:scale-105 transition-transform duration-1000">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-sm font-semibold text-gray-800">Revolutionary AI</span>
                </div>
                <p className="text-xs text-gray-600">Transforming Healthcare</p>
                <div className="mt-2 flex space-x-1">
                  <div className="w-1 h-4 bg-culinary-400 rounded animate-[grow_2s_ease-in-out_infinite]"></div>
                  <div className="w-1 h-4 bg-medical-400 rounded animate-[grow_2s_ease-in-out_infinite_0.2s]"></div>
                  <div className="w-1 h-4 bg-green-400 rounded animate-[grow_2s_ease-in-out_infinite_0.4s]"></div>
                </div>
              </div>

              {/* Removed stats overlay per simplified landing request */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HumanIntuitionSection;
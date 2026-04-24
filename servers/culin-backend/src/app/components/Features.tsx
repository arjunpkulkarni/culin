import React, { useEffect, useRef } from "react";
import { Brain, Dna, Activity, ChefHat, Shield, Utensils } from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
}

const FeatureCard = ({ icon, title, description, index }: FeatureCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, []);
  
  return (
    <div 
      ref={cardRef}
      className="feature-card glass-card opacity-0 p-4 sm:p-6 lg:hover:bg-gradient-to-br lg:hover:from-white lg:hover:to-culinary-50 transition-all duration-300"
      style={{ animationDelay: `${0.1 * index}s` }}
    >
      <div className="rounded-full bg-culinary-50 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-culinary-500 mb-4 sm:mb-5">
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{title}</h3>
      <p className="text-gray-600 text-sm sm:text-base">{description}</p>
    </div>
  );
};

const Features = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elements = entry.target.querySelectorAll(".fade-in-element");
            elements.forEach((el, index) => {
              setTimeout(() => {
                el.classList.add("animate-fade-in");
              }, index * 100);
            });
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
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
    <section className="py-12 sm:py-16 md:py-20 pb-0 relative bg-gray-50" id="features" ref={sectionRef}>
      <div className="section-container">
        <div className="text-center mb-10 sm:mb-16">
          <div className="culinary-chip mx-auto mb-3 sm:mb-4 opacity-0 fade-in-element">
            <span>Precision Medicine</span>
          </div>
          <h2 className="section-title mb-3 sm:mb-4 opacity-0 fade-in-element">
            Omics-Driven <br className="hidden sm:block" />Personalized Nutrition
          </h2>
          <p className="section-subtitle mx-auto opacity-0 fade-in-element">
            Combining genomics, proteomics, and clinical data to create truly personalized medicinal recipes.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <FeatureCard
            icon={<Dna className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Genomic Analysis"
            description="Analyze genetic variants affecting nutrient metabolism, food sensitivities, and disease predisposition to create personalized nutrition plans."
            index={0}
          />
          <FeatureCard
            icon={<Activity className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Clinical Integration"
            description="Seamlessly integrate with EMR systems to analyze ICD-10 codes, lab results, vitals, and clinical notes for comprehensive health profiling."
            index={1}
          />
          <FeatureCard
            icon={<Brain className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="AI Recipe Generation"
            description="Advanced AI creates medicinal recipes tailored to specific conditions like diabetes, hypertension, heart failure, and post-surgical recovery."
            index={2}
          />
          <FeatureCard
            icon={<ChefHat className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Human-in-the-Loop"
            description="Nutritionists and chefs review and refine AI-generated recipes to ensure clinical efficacy and culinary excellence."
            index={3}
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Clinical Validation"
            description="Evidence-based approach with continuous monitoring of patient outcomes and adjustment of nutritional interventions."
            index={4}
          />
          <FeatureCard
            icon={<Utensils className="w-5 h-5 sm:w-6 sm:h-6" />}
            title="Multi-Modal Delivery"
            description="From hospital wards to home kitchens - delivering personalized nutrition wherever patients need it most."
            index={5}
          />
        </div>
      </div>
    </section>
  );
};

export default Features;
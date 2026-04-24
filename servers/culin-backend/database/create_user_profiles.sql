-- Create user_profiles table for CulinAI
-- This stores Cognito user info + additional onboarding data

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,  -- Cognito user ID (sub claim from JWT)
    email VARCHAR(255) NOT NULL UNIQUE,
    
    -- Basic Info (filled during onboarding)
    display_name VARCHAR(255),
    date_of_birth DATE,
    height INTEGER,  -- in cm
    weight INTEGER,  -- in kg
    sex VARCHAR(10),  -- 'M', 'F', or 'Other'
    
    -- Goals & Health (filled during onboarding)
    goals JSONB,  -- ["lose_fat", "build_muscle", "maintain"]
    health_conditions JSONB,  -- ["diabetes", "high_bp", "celiac"]
    dietary_restrictions JSONB,  -- ["vegetarian", "vegan", "gluten_free"]
    
    -- Nutrition Targets (calculated or user-set)
    target_calories INTEGER,
    target_protein INTEGER,
    target_carbs INTEGER,
    target_fat INTEGER,
    
    -- Profile
    photo_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_user_profiles_created ON user_profiles(created_at);

-- Create index on onboarding_completed for filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to call the function before any update
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing (optional - remove in production)
-- INSERT INTO user_profiles (user_id, email, display_name, onboarding_completed) 
-- VALUES ('test-123', 'test@example.com', 'Test User', false)
-- ON CONFLICT (user_id) DO NOTHING;

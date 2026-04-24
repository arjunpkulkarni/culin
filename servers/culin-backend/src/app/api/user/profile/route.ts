/**
 * POST /api/user/profile
 * Create a new user profile after Cognito signup
 * 
 * This is called automatically after a user signs up with Cognito
 * to create their initial profile in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthUser } from '@/lib/api-auth-middleware';
import { query, UserProfile } from '@/lib/db';

async function handler(req: NextRequest, user: AuthUser) {
  try {
    const body = await req.json();
    const { email, displayName } = body;

    // Get user_id from JWT token (Cognito sub)
    const userId = user.sub;
    const userEmail = email || user.email;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const existingUser = await query<UserProfile>(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { 
          message: 'User profile already exists',
          profile: existingUser.rows[0]
        },
        { status: 200 }
      );
    }

    // Create new user profile
    const result = await query<UserProfile>(
      `INSERT INTO user_profiles (user_id, email, display_name, onboarding_completed)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, userEmail, displayName || null, false]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'User profile created successfully',
        profile: result.rows[0]
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Error creating user profile:', error);
    
    if (error.code === '23505') { // PostgreSQL unique violation
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

/**
 * GET /api/user/profile
 * Fetch the current user's profile
 */
async function getHandler(req: NextRequest, user: AuthUser) {
  try {
    const userId = user.sub;

    const result = await query<UserProfile>(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile: result.rows[0]
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getHandler);

/**
 * PUT /api/user/profile
 * Update user profile with onboarding data
 * 
 * This is called after the user completes onboarding steps
 * to fill in their health goals, dietary restrictions, etc.
 */
async function updateHandler(req: NextRequest, user: AuthUser) {
  try {
    const userId = user.sub;
    const body = await req.json();

    const {
      displayName,
      dateOfBirth,
      height,
      weight,
      sex,
      goals,
      healthConditions,
      dietaryRestrictions,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      photoURL,
      onboardingCompleted,
    } = body;

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (displayName !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      values.push(displayName);
    }
    if (dateOfBirth !== undefined) {
      updates.push(`date_of_birth = $${paramIndex++}`);
      values.push(dateOfBirth ? new Date(dateOfBirth) : null);
    }
    if (height !== undefined) {
      updates.push(`height = $${paramIndex++}`);
      values.push(height);
    }
    if (weight !== undefined) {
      updates.push(`weight = $${paramIndex++}`);
      values.push(weight);
    }
    if (sex !== undefined) {
      updates.push(`sex = $${paramIndex++}`);
      values.push(sex);
    }
    if (goals !== undefined) {
      updates.push(`goals = $${paramIndex++}`);
      values.push(JSON.stringify(goals));
    }
    if (healthConditions !== undefined) {
      updates.push(`health_conditions = $${paramIndex++}`);
      values.push(JSON.stringify(healthConditions));
    }
    if (dietaryRestrictions !== undefined) {
      updates.push(`dietary_restrictions = $${paramIndex++}`);
      values.push(JSON.stringify(dietaryRestrictions));
    }
    if (targetCalories !== undefined) {
      updates.push(`target_calories = $${paramIndex++}`);
      values.push(targetCalories);
    }
    if (targetProtein !== undefined) {
      updates.push(`target_protein = $${paramIndex++}`);
      values.push(targetProtein);
    }
    if (targetCarbs !== undefined) {
      updates.push(`target_carbs = $${paramIndex++}`);
      values.push(targetCarbs);
    }
    if (targetFat !== undefined) {
      updates.push(`target_fat = $${paramIndex++}`);
      values.push(targetFat);
    }
    if (photoURL !== undefined) {
      updates.push(`photo_url = $${paramIndex++}`);
      values.push(photoURL);
    }
    if (onboardingCompleted !== undefined) {
      updates.push(`onboarding_completed = $${paramIndex++}`);
      values.push(onboardingCompleted);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Add userId for WHERE clause
    values.push(userId);

    const updateQuery = `
      UPDATE user_profiles 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING *
    `;

    const result = await query<UserProfile>(updateQuery, values);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Profile updated successfully',
        profile: result.rows[0]
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}

export const PUT = withAuth(updateHandler);

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

    // Try to create. If the email already exists under a different user_id
    // (e.g. an orphaned row from a previous Cognito pool / sub), re-link it
    // to the current authenticated sub instead of erroring. The Cognito JWT
    // already proves the caller owns this email, so this is safe.
    try {
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
    } catch (insertErr: any) {
      if (insertErr?.code === '23505') {
        const relinked = await query<UserProfile>(
          `UPDATE user_profiles
           SET user_id = $1${displayName ? ', display_name = $3' : ''}
           WHERE email = $2
           RETURNING *`,
          displayName ? [userId, userEmail, displayName] : [userId, userEmail]
        );
        if (relinked.rowCount && relinked.rows.length > 0) {
          return NextResponse.json(
            {
              success: true,
              message: 'User profile re-linked to current Cognito user',
              profile: relinked.rows[0]
            },
            { status: 200 }
          );
        }
      }
      throw insertErr;
    }

  } catch (error: any) {
    console.error('Error creating user profile:', error);

    return NextResponse.json(
      { error: 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handler);

/**
 * GET /api/user/profile
 * Fetch the current user's profile. Auto-creates the row on first
 * access so newly signed-up users get a profile record without the
 * mobile app having to call POST separately.
 */
async function getHandler(req: NextRequest, user: AuthUser) {
  try {
    const userId = user.sub;

    const result = await query<UserProfile>(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Lazy onboard: create the row using whatever attributes Cognito
      // gave us. The user can fill in the rest via PUT.
      const userEmail = user.email ?? null;
      try {
        const created = await query<UserProfile>(
          `INSERT INTO user_profiles (user_id, email, display_name, onboarding_completed)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [userId, userEmail, null, false]
        );
        return NextResponse.json(
          { success: true, profile: created.rows[0] },
          { status: 200 }
        );
      } catch (insertErr: any) {
        // Race: another request just inserted with this user_id. Re-read.
        if (insertErr?.code === '23505') {
          const retry = await query<UserProfile>(
            'SELECT * FROM user_profiles WHERE user_id = $1',
            [userId]
          );
          if (retry.rows.length > 0) {
            return NextResponse.json(
              { success: true, profile: retry.rows[0] },
              { status: 200 }
            );
          }
          // Otherwise the row exists under a *different* user_id with the
          // same email (orphaned from a prior Cognito pool/sub). The current
          // JWT proves the caller owns this email, so re-link it.
          if (userEmail) {
            const relinked = await query<UserProfile>(
              `UPDATE user_profiles SET user_id = $1
               WHERE email = $2
               RETURNING *`,
              [userId, userEmail]
            );
            if (relinked.rowCount && relinked.rows.length > 0) {
              return NextResponse.json(
                { success: true, profile: relinked.rows[0] },
                { status: 200 }
              );
            }
          }
        }
        throw insertErr;
      }
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

    // No row yet: insert one with the provided fields, then return it.
    // This makes PUT effectively an upsert and means the mobile app can
    // call it even before GET has lazily created the record.
    if (result.rowCount === 0) {
      const userEmail = user.email ?? null;
      try {
        await query<UserProfile>(
          `INSERT INTO user_profiles (user_id, email, display_name, onboarding_completed)
           VALUES ($1, $2, $3, $4)`,
          [userId, userEmail, displayName ?? null, onboardingCompleted ?? false]
        );
        const second = await query<UserProfile>(updateQuery, values);
        return NextResponse.json(
          {
            success: true,
            message: 'Profile created and updated',
            profile: second.rows[0],
          },
          { status: 200 }
        );
      } catch (insertErr: any) {
        // Email already exists under a different user_id (orphaned row from
        // a prior Cognito pool/sub). Re-link it to the current authenticated
        // sub, then re-run the dynamic update.
        if (insertErr?.code === '23505' && userEmail) {
          await query(
            `UPDATE user_profiles SET user_id = $1 WHERE email = $2`,
            [userId, userEmail]
          );
          const second = await query<UserProfile>(updateQuery, values);
          if (second.rowCount && second.rows.length > 0) {
            return NextResponse.json(
              {
                success: true,
                message: 'Profile re-linked and updated',
                profile: second.rows[0],
              },
              { status: 200 }
            );
          }
        }
        console.error('Profile upsert insert failed:', insertErr);
        return NextResponse.json(
          { error: 'Failed to upsert user profile' },
          { status: 500 }
        );
      }
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

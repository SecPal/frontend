<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Employee;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Optional reference seeder — the canonical Playwright onboarding user is seeded by
 * {@see OnboardingDemoUserSeeder} in this repository (`onboarding@example.com`).
 *
 * If you maintain a fork without `OnboardingDemoUserSeeder`, copy this file to
 * `database/seeders/OnboardingE2eUserSeeder.php`, register it in `DatabaseSeeder`, and
 * align model usage with your tenant/org bootstrap.
 *
 * Critical field for wizard API tests: `onboarding_workflow_status` must not stay at
 * `invited` after login — draft submissions transition to `in_progress`, which is only
 * allowed from `account_initialized` or `in_progress` (see `Employee::ALLOWED_WORKFLOW_TRANSITIONS`).
 */
class OnboardingE2eUserSeeder extends Seeder
{
    public const EMAIL = 'onboarding@example.com';

    public const PASSWORD_PLAINTEXT = 'password';

    public function run(): void
    {
        DB::transaction(function () {
            DB::table('employees')->where('email', self::EMAIL)->delete();
            DB::table('users')->where('email', self::EMAIL)->delete();

            $tenantId = DB::table('tenants')->orderBy('id')->value('id');
            if ($tenantId === null) {
                throw new \RuntimeException(
                    'OnboardingE2eUserSeeder: no tenant; seed tenants first or ADJUST tenant resolution.'
                );
            }

            $unitId = DB::table('organizational_units')
                ->where('tenant_id', $tenantId)
                ->orderBy('id')
                ->value('id');
            if ($unitId === null) {
                throw new \RuntimeException(
                    'OnboardingE2eUserSeeder: no organizational unit; ADJUST query or seed org structure.'
                );
            }

            $now = now();

            $userId = DB::table('users')->insertGetId([
                'tenant_id' => $tenantId,
                'name' => 'John Doe',
                'email' => self::EMAIL,
                'password' => Hash::make(self::PASSWORD_PLAINTEXT),
                'email_verified_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('employees')->insert([
                'tenant_id' => $tenantId,
                'user_id' => $userId,
                'employee_number' => 'E2E-ONBOARD-001',
                'first_name' => 'John',
                'last_name' => 'Doe',
                'email' => self::EMAIL,
                'date_of_birth' => '1990-01-01',
                'contract_start_date' => '2028-05-01',
                'position' => 'Sicherheitsmitarbeiter',
                'management_level' => 0,
                'status' => 'pre_contract',
                'contract_type' => 'full_time',
                'organizational_unit_id' => $unitId,
                'onboarding_completed' => false,
                'onboarding_workflow_status' => 'account_initialized',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        });
    }
}

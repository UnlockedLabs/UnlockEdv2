<?php

declare(strict_types=1);

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserActivityMapRequest;
use App\Http\Resources\UserActivityMapResource;
use App\Models\UserCourseActivity;
use Illuminate\Support\Facades\DB;

class UserActivityMapController extends Controller
{
    public function show(int $id, UserActivityMapRequest $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $valid = $request->validated();
        $startDate = $valid['start_date'] ?? null;
        $endDate = $valid['end_date'] ?? null;

        $query = UserCourseActivity::where('user_id', $id);

        // If start_date is provided, filter records with a date greater than or equal to start_date
        if ($startDate) {
            $query->whereDate(DB::raw('DATE(date)'), '>=', $startDate);
        }

        // If end_date is provided, filter records with a date less than or equal to end_date
        if ($endDate) {
            $query->whereDate(DB::raw('DATE(date)'), '<=', $endDate);
        }

        $aggregatedData = $query
            ->select(
                'user_id',
                DB::raw('DATE(date) as date'), // Extracting date part
                DB::raw('SUM(external_has_activity) as active_course_count'),
                DB::raw('SUM(external_total_activity_time_delta) as total_activity_time')
            )
            ->groupBy('user_id', DB::raw('DATE(date)')) // Grouping by date part
            ->get();

        if ($aggregatedData->isEmpty()) {
            return UserActivityMapResource::collection([]);
        }

        // Calculate quartiles for total_activity_time
        $totalActivityTimes = $aggregatedData->pluck('total_activity_time')->toArray();
        $totalActivityTimeQuartiles = $this->calculateQuartiles($totalActivityTimes);

        // Assign quartile scores for each day
        foreach ($aggregatedData as $key => $data) {
            $totalActivityTime = $data['total_activity_time'];
            $aggregatedData[$key]['total_activity_time_quartile'] = $this->getQuartileScore($totalActivityTime, $totalActivityTimeQuartiles);
        }

        return UserActivityMapResource::collection($aggregatedData);
    }

    /**
     * Calculate quartiles for a given dataset.
     * This function handles zero values differently than a standard quartile function.
     * It excludes zero values and splits only non-zero values into approximately equally sized buckets.
     *
     * @return array<string, int>
     */
    private function calculateQuartiles(array $data): array
    {
        // Remove zeros from the data
        $data = array_filter($data, function ($value) {
            return $value != 0;
        });

        // Count the non-zero values
        $count = count($data);

        // Sort the non-zero data
        sort($data);

        // Calculate quartiles
        $q1 = $data[floor($count / 4)];
        $q2 = $data[floor($count / 2)];
        $q3 = $data[floor(3 * $count / 4)];

        return compact('q1', 'q2', 'q3');
    }

    /**
     * Assign quartile score to a given value.
     *
     * @param  array<string, int>  $quartiles
     */
    private function getQuartileScore(string|int $value, array $quartiles): int
    {
        if (is_string($value)) {
            $value = (int) $value;
        }

        return match (true) {
            ($value == 0) => 0,
            ($value <= $quartiles['q1']) => 1,
            ($value <= $quartiles['q2']) => 2,
            ($value <= $quartiles['q3']) => 3,
            default => 4,
        };
    }
}

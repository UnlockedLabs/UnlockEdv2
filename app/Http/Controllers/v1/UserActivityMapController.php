<?php

namespace App\Http\Controllers\v1;

use App\Http\Controllers\Controller;
use App\Models\UserCourseActivity;
use Illuminate\Support\Facades\DB;

class UserActivityMapController extends Controller
{
    public function show($id)
    {
        $aggregatedData = UserCourseActivity::where('user_id', $id)
            ->select(
                'user_id',
                DB::raw('DATE(date) as date'), // Extracting date part
                DB::raw('SUM(external_has_activity) as active_course_count'),
                DB::raw('SUM(external_total_activity_time_delta) as total_activity_time')
            )
            ->groupBy('user_id', DB::raw('DATE(date)')) // Grouping by date part
            ->get();

        if (count($aggregatedData) == 0) {
            return response()->json(['error' => 'Resource not found'], 404);
        }
        // Calculate quartiles for total_activity_time
        $totalActivityTimes = $aggregatedData->pluck('total_activity_time')->toArray();
        $totalActivityTimeQuartiles = $this->calculateQuartiles($totalActivityTimes);

        // Assign quartile scores for each day
        foreach ($aggregatedData as $key => $data) {
            $totalActivityTime = $data->total_activity_time;
            $aggregatedData[$key]->total_activity_time_quartile = $this->getQuartileScore($totalActivityTime, $totalActivityTimeQuartiles);
        }

        return response()->json($aggregatedData);
    }

    private function calculateQuartiles($data)
    {
        // Remove zeros from the data
        $data = array_filter($data, function ($value) {
            return $value != 0;
        });

        // Count the non-zero values
        $count = count($data);

        // // If there are no non-zero values, return null for all quartiles
        // if ($count === 0) {
        //     return ['q1' => null, 'q2' => null, 'q3' => null];
        // }

        // Sort the non-zero data
        sort($data);

        // Calculate quartiles
        $q1 = $data[floor($count / 4)];
        $q2 = $data[floor($count / 2)];
        $q3 = $data[floor(3 * $count / 4)];

        return compact('q1', 'q2', 'q3');
    }

    private function getQuartileScore($value, $quartiles)
    {
        if ($value == 0) {
            return 0;
        }
        if ($value <= $quartiles['q1']) {
            return 1;
        }
        if ($value <= $quartiles['q2']) {
            return 2;
        }
        if ($value <= $quartiles['q3']) {
            return 3;
        }

        return 4;
    }
}

<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Auth;
use App\Models\UserActivity;

class UserActivityMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */    
    public function handle($request, Closure $next)
    {
        $user = Auth::user();
        
        if ($user) {
            $user_agent = $request->header('User-Agent');
            $activity = new UserActivity();
            $activity->user_id = $user->id;
            $activity->browser_name = $this->getBrowser($user_agent);
            $activity->platform = $this->getPlatform($user_agent);
            $activity->device = $this->getDevice($user_agent);
            $activity->ip = $request->ip();
            $activity->clicked_url = $request->fullUrl();
            $activity->save();
        }

        return $next($request);
    }

    private function getBrowser($userAgent)
    {
        $userAgent = strtolower($userAgent);
    
        $browsers = ['Chrome', 'Firefox'];
    
        foreach ($browsers as $browser) {
            if (strpos($userAgent, strtolower($browser)) !== false) {
                return $browser;
            }
        }
    
        // If no match is found
        return 'Other';
    } 

    private function getDevice($userAgent)
    {
        $userAgent = strtolower($userAgent);
    
        // Define patterns for common devices
        $mobilePatterns = ['/phone/', '/ipad/', '/ipod/', '/android/', '/mobile/'];
    
        foreach ($mobilePatterns as $pattern) {
            if (preg_match($pattern, $userAgent)) {
                return 'Mobile';
            }
        }
    
        // If no match is found, assume 'Desktop'
        return 'Desktop';
    }

    private function getPlatform($userAgent)
    {
        $platform = 'Unknown';
    
        if (preg_match('/windows|win32/i', $userAgent)) {
            $platform = 'Windows';
        } elseif (preg_match('/android/i', $userAgent)) {
            $platform = 'Android';
        } elseif (preg_match('/iphone|ipad|ipod/i', $userAgent)) {
            $platform = 'iOS';
        } elseif (preg_match('/macintosh|mac os x/i', $userAgent)) {
            $platform = 'Mac';
        } elseif (preg_match('/linux/i', $userAgent)) {
            $platform = 'Linux';
        } elseif (preg_match('/x11/i', $userAgent)) {
            $platform = 'X11';
        }
    
        return $platform;
    }
    
}

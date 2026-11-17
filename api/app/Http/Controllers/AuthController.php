<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public static function register (Request $request)  {
        $validated = $request->validate([
            'name' => 'string|required|min:3',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed'
        ]);

        $user = User::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'Registrasi Berhasil!',
            'data' => $user
        ]);
    }

    public static function login(Request $request) {
        
    }
}

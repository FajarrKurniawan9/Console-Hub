<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public static function register (Request $request)  {
        $validated = $request->validate([
            'name' => 'string|required|min:3',
            'email' => 'required|email|unique:users,email',
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
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|min:8'
        ]);

        $user = User::firstWhere('email' , $request->email);

        if (!$user || Hash::check($request->password , $user->password)) {
            return response()->json([
                'success'=> false,
                'message' => 'Email / Password salah'
            ] , 401);
        }

        $token = $user->createToken('auth_token')->plainTextToken;
        $user->token = $token;
        
        return response()->json([
            'success' => true,
            'message' => 'Login Berhasil!',
            'data' => $user
        ]);
    }

    public static function logout(Request $request) {
        $request->user()->tokens()->delete();

        return response()->json([
            'success' => true , 
            'message' => 'Logout Berhasil'
        ]);
    }

    public static function me(Request $request){
        $user = $request->user();

        return response()->json([
            'success' => true ,
            'message' => 'Berhasil Mengambil Data Me!',
            'data' => $user
        ]);
    }
}

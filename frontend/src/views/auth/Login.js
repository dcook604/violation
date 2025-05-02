import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    try {
      // Call the login function directly with credentials
      await login({ email, password });
      // Navigation is handled in the AuthContext
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    }
  };

  // CSS styles for the title text
  const titleContainerStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '20px',
    minHeight: '80px',
    padding: '10px',
  };

  const titleStyles = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#2C5282', // lightBlue-800
    textAlign: 'center',
    lineHeight: '1.2'
  };

  return (
    <>
      <div className="container mx-auto px-4 h-full">
        <div className="flex content-center items-center justify-center h-full">
          <div className="w-full lg:w-4/12 px-4">
            <div className="relative flex flex-col min-w-0 break-words w-full mb-6 shadow-lg rounded-lg bg-white border-0">
              <div className="rounded-t mb-0 px-6 py-6">
                {/* Title text instead of logo */}
                <div style={titleContainerStyles}>
                  <h1 style={titleStyles}>
                    Spectrum 4<br />
                    <span style={{ fontSize: '75%' }}>Violation Tracking</span>
                  </h1>
                </div>
                <div className="text-center mb-3">
                  <h6 className="text-blueGray-500 text-sm font-bold">
                    Sign in with credentials
                  </h6>
                </div>
                <hr className="mt-6 border-b-1 border-blueGray-300" />
              </div>
              <div className="flex-auto px-4 lg:px-10 py-10 pt-0">
                <form onSubmit={handleSubmit}>
                  <div className="relative w-full mb-3">
                    <label
                      className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
                      htmlFor="email"
                    >
                      Email
                    </label>
          <input
                      id="email"
            type="email"
                      className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
            placeholder="Email"
            value={email}
                      onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

                  <div className="relative w-full mb-3">
                    <label
                      className="block uppercase text-blueGray-600 text-xs font-bold mb-2"
                      htmlFor="password"
                    >
                      Password
                    </label>
          <input
                      id="password"
            type="password"
                      className="border-0 px-3 py-3 placeholder-blueGray-300 text-blueGray-600 bg-white rounded text-sm shadow focus:outline-none focus:ring w-full ease-linear transition-all duration-150"
            placeholder="Password"
            value={password}
                      onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

                  <div className="text-center mt-6">
                    <button
                      className="bg-lightBlue-500 text-white active:bg-lightBlue-600 text-sm font-bold uppercase px-6 py-3 rounded shadow hover:shadow-lg outline-none focus:outline-none mr-1 mb-1 w-full ease-linear transition-all duration-150"
                      type="submit"
                    >
                      Sign In
                    </button>
                  </div>
                  {error && (
                    <div className="text-red-500 text-center text-sm font-semibold mt-4">
                      {error}
                    </div>
                  )}
      </form>
    </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 
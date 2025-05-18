import { useEffect, useState } from "react";
import './auth.css';
import { useNavigate } from "react-router-dom";
import { Toaster, toast } from 'sonner';

const Auth = () => {
  const [log, setlog] = useState(true);
  const [email, setemail] = useState("");
  const [logerr, setlogerr] = useState(false);
  const [password, setpassword] = useState("");
  const [cpassword, setcpassword] = useState("");
  const navigate = useNavigate();

  const passnotmatch = () => {
    toast.error('Both passwords are not same!', {
      duration: 3000,
      position: 'bottom-right',
      style: { background: '#FF5C5C', color: '#fff' },
    });
  };

  const userexists = () => {
    toast.error('This email id is already registered!', {
      duration: 3000,
      position: 'bottom-right',
      style: { background: '#FF5C5C', color: '#fff' },
    });
  };

  const nullerror = () => {
    toast.error('email and password are required!', {
      duration: 3000,
      position: 'bottom-right',
      style: { background: '#FF5C5C', color: '#fff' },
    });
  };

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/isAuth', {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const handleRegistration = async (event) => {
    event.preventDefault();
    if (email !== "" && password !== "" && password === cpassword) {
      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data !== "user already exists") {
          navigate("/");
          fetchUser();
        } else {
          userexists();
        }
      } catch (err) {
        console.error("Registration error:", err);
      }
    } else if (password !== cpassword) {
      passnotmatch();
    } else {
      nullerror();
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch("/api/log", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.user) {
        navigate("/");
      } else {
        setlogerr(true);
      }
    } catch (err) {
      console.error("Login failed:", err);
      setlogerr(true);
    }
  };
  return (
    <div className="w-[100vw] h-[100vh] flex items-center justify-center bg-[#121212] relative bg-[url('image3.png')] bg-cover bg-center">
        <div className="w-[100vw] h-[100vh] flex items-center justify-evenly bg-[#12121262] md:w-[100vw] md:h-[100vh]">
        
            <div className="w-[80vw] h-[70vh] flex flex-col items-center justify-center ">
            <div className="w-[50vw] h-[7vh] flex items-center justify-between rounded-3xl bg-[#2C2C2C] border-[2px] border-[#007BFF] px-2 md:w-[20vw] md:h-[8vh]">
                <button className={log?"text-[3.5vw] font-medium text-[#F5F5F5] bg-[#1975d8] rounded-4xl py-1.5 px-5 flex items-center justify-center md:text-[1.8vw] md:py-[0.02vw] md:px-5 cursor-pointer rounded-3xl":"text-[3vw] font-medium text-[#A0A0A0] flex items-center justify-center py-1.5 px-5 md:text-[1.5vw] md:py-0.5 md:px-5 cursor-pointer"} onClick={()=>setlog(true)}>Login</button>
                <button className={!log?"text-[3.5vw] font-medium text-[#F5F5F5] bg-[#1975d8] rounded-4xl py-1.5 px-5 flex items-center justify-center md:text-[1.8vw] md:py-[0.02vw] md:px-5 cursor-pointer rounded-3xl":"text-[3vw] font-medium text-[#A0A0A0] flex items-center justify-center py-1.5 px-5 md:text-[1.5vw] md:py-0.5 md:px-5 cursor-pointer"}  onClick={()=>setlog(false)}>Signup</button>
            </div>
            {logerr?<h1 className="text-[#E63946] absolute top-50">Email or Password is not correct</h1>:""}
            {log?<>
            <div className="w-[60vw] md:w-[30vw] h-[50vh]  mt-5">
                <h1 className=" text-[6vw] md:text-[2vw] font-medium text-[#007BFF]">Login</h1>
                <p className="text-white text-[3vw] md:text-[1vw]">Log in to your account</p>
                <form onSubmit={handleLogin} className="flex flex-col gap-6 mt-4">
                    <input type="email" onChange={(e)=>{setemail(e.target.value)}} name="email" id="email" placeholder="Enter email.." className="md:text-2xl text-blue-100 bg-[#2C2C2C] px-2 py-2 rounded-2xl "/>
                    <input type="text" onChange={(e)=>{setpassword(e.target.value)}} name="password" id="password" placeholder="Enter password.." className="md:text-2xl text-blue-100 bg-[#2C2C2C] px-2 py-2 rounded-2xl "/>
                    <button type="submit" className="text-[3.5vw] w-[20vw] ml-20 font-medium text-[#F5F5F5] bg-[#1975d8] rounded-4xl py-1.5 px-5 flex items-center justify-center md:text-[1.8vw] md:py-0.5 md:px-5 cursor-pointer rounded-2xl">Login</button>
                </form>
                
            </div>
            </>:<>
            <div className="w-[60vw] md:w-[30vw] h-[50vh]  mt-5 relative">
               <h1 className=" text-[6vw] md:text-[2vw] font-medium text-[#007BFF]">Signup</h1>
                {/* <p className="text-white text-[3vw] md:text-[1vw]">Connect. Chat. Share. Anywhere, Anytime!</p> */}
                <form onSubmit={handleRegistration} className="flex  flex-col gap-6 mt-4">
                    <input type="email" onChange={(e)=>{setemail(e.target.value)}} name="email" id="email" placeholder="Enter email.." className="md:text-2xl text-blue-100 bg-[#2C2C2C] px-2 py-2 rounded-2xl "/>
                    <input type="text" onChange={(e)=>{setpassword(e.target.value)}} name="password" id="password" placeholder="Enter password.." className="md:text-2xl text-blue-100 bg-[#2C2C2C] px-2 py-2 rounded-2xl "/>
                    <input type="text" onChange={(e)=>{setcpassword(e.target.value)}} name="Cpassword" id="Cpassword" placeholder="Confirm password.." className=" mb-0 md:text-2xl text-blue-100 bg-[#2C2C2C] px-2 py-2 rounded-2xl "/>
                    {cpassword!=password?<p className="absolute top-10 text-[#E63946] text-[3vw] left-2 md:text-[1vw] md:top-10">Both passwords must be same</p>:""}
                    <button type="submit" className="text-[3.5vw] font-medium text-[#F5F5F5] bg-[#1975d8] w-[20vw] ml-17 md:ml-20  py-1.5 px-5 flex items-center justify-center md:text-[1.8vw] md:py-0.5 md:px-5 cursor-pointer rounded-2xl">Signup</button>
                </form>
            </div>
                </>
                }
            </div>
        </div>
        <Toaster />
    </div>
  );
};

export default Auth;

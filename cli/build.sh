set -e

git submodule update --init --recursive 

cd ./yosys

# Toggled the custom Yosys library flag to ON
cmake -B build . -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON -DYOSYS_INSTALL_LIBRARY=ON
cmake --build build --config Release --parallel $(nproc)
sudo cmake --install build --strip

cd ..

# Compile and link. (If it fails to find -lyosys, swap -L/usr/local/lib with -L/usr/local/lib64)
g++ main.cpp ./src/*.cpp -I./include $(yosys-config --cxxflags) $(yosys-config --ldflags) -o fpgahub -L/usr/local/lib -lyosys 

sudo mv ./fpgahub /usr/local/bin/fpgahub
sudo chmod +x /usr/local/bin/fpgahub

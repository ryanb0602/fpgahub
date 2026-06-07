set -e

git submodule update --init --recursive 

cd ./yosys

cmake -B build . -DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=ON -DYOSYS_INSTALL_LIBRARY=ON
cmake --build build --config Release --parallel $(nproc)
sudo cmake --install build --strip

cd ..

sudo mv /usr/local/lib/yosys/libyosys.so /usr/local/lib/
sudo ldconfig

g++ main.cpp ./src/*.cpp -I./include $(yosys-config --cxxflags) $(yosys-config --ldflags) -o fpgahub -L/usr/local/lib -L/usr/local/lib64 -Wl,-rpath,/usr/local/lib -Wl,-rpath,/usr/local/lib64 -lyosys

sudo mv ./fpgahub /usr/local/bin/fpgahub
sudo chmod +x /usr/local/bin/fpgahub

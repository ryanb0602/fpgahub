library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

--fake change

entity weight_bram is
    Generic (
        NUM_WEIGHTS : integer := 784 --default for hidden layer
    );
    Port (
        clk      : in  std_logic;
        -- Port A: Training (Full 8-bit Access)
        we       : in  std_logic;
        addr_w   : in  unsigned(9 downto 0); -- 0 to 783 (pixel index)
        data_in  : in  std_logic_vector(7 downto 0);
        data_out_8b : out std_logic_vector(7 downto 0); -- Read back for gradient update
        
        -- Port B: Forward Pass (Binarized)
        addr_r   : in  unsigned(9 downto 0);
        bin_out  : out std_logic  -- Just the sign bit (MSB)
    );
end weight_bram;

architecture RTL of weight_bram is
    -- Each BRAM stores 784 weights for ONE neuron
    type ram_type is array (0 to NUM_WEIGHTS - 1) of std_logic_vector(7 downto 0);
    signal RAM : ram_type := (others => (others => '0'));
    signal addr_w_buf : unsigned(9 downto 0);
begin
    addr_w_buf <= addr_w when addr_w < NUM_WEIGHTS else "0000000000";
    process(clk)
    begin
        if rising_edge(clk) then
            -- Port A: Training Access
            if we = '1' then
                RAM(to_integer(addr_w)) <= data_in;
            end if;
            data_out_8b <= RAM(to_integer(addr_w_buf)); 

            -- Port B: Fast Forward Pass
            -- bin_out is the sign bit of the weight
            -- In 2's complement: 0 = Positive (+1), 1 = Negative (-1)
            bin_out <= RAM(to_integer(addr_r))(7); 
        end if;
    end process;
end RTL;

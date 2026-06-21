library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity pe_bram is
    Generic (
        NUM_WEIGHTS : integer := 784 -- Depth (number of pixels)
    );
    Port (
        clk         : in  std_logic;
        
        -- Port A: Training / Writing (8-bit selective)
        -- we is now 16 bits wide (one bit per byte of the 128-bit word)
        we          : in  std_logic_vector(15 downto 0); 
        addr_w      : in  unsigned(9 downto 0); 
        data_in     : in  std_logic_vector(127 downto 0); -- Still wide, but only the enabled byte is saved
        data_out_8b : out std_logic_vector(127 downto 0); 
        
        -- Port B: Forward Pass
        addr_r      : in  unsigned(9 downto 0);
        dout_wide   : out std_logic_vector(127 downto 0)
    );
end pe_bram;

architecture RTL of pe_bram is
    type ram_type is array (0 to NUM_WEIGHTS - 1) of std_logic_vector(127 downto 0);
    signal RAM : ram_type := (others => (others => '0'));
begin
    process(clk)
    begin
        if rising_edge(clk) then
            -- Selective Writing logic
            for i in 0 to 15 loop
                if we(i) = '1' then
                    -- Update only the 8-bit slice for the active neuron
                    RAM(to_integer(addr_w))((i*8)+7 downto (i*8)) <= data_in((i*8)+7 downto (i*8));
                end if;
            end loop;

            data_out_8b <= RAM(to_integer(addr_w)); 
            dout_wide   <= RAM(to_integer(addr_r)); 
        end if;
    end process;
end RTL;
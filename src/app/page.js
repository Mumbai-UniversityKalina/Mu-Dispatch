"use client"

import { useState } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Slab } from 'react-loading-indicators';
import { FaSearch } from 'react-icons/fa';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Header from '@/components/header';
import Footer from '@/components/footer';

const BASE_URL = "https://mucollegdb.pockethost.io";
const ENDPOINT_GET_DISPATCH = "/api/collections/dispatch/records";
const ENDPOINT_GET_COLLEGES = "/api/collections/colleges/records";
const ENDPOINT_UPDATE_DISPATCH = "/api/collections/dispatch/records";
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_ACCESS_TOKEN', // Ensure you replace this with your actual API token
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatDateForAPI = (date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0));
  return utcDate.toISOString().split('T')[0]; // Return date in YYYY-MM-DD format
};

export default function Home() {
  const [dispatchData, setDispatchData] = useState([]);
  const [collegesData, setCollegesData] = useState({});
  const [collegeCache, setCollegeCache] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [routeCode, setRouteCode] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDispatchData = async () => {
    console.log('Fetching dispatch data...');
    setLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}${ENDPOINT_GET_DISPATCH}?page=${currentPage}&perPage=30&filter=exam_date=%${formatDateForAPI(selectedDate)}%`, { headers: HEADERS });
      if (response.status === 200) {
        console.log(`Fetched dispatch data from page ${currentPage}`, response.data.items);
        const pendingDispatchData = response.data.items.filter(item => item.status === 'Pending');
        setDispatchData(pendingDispatchData);
        setTotalPages(response.data.totalPages);
        toast.success('Dispatch data fetched successfully');
        await delay(2000); // Delay for 2 seconds before fetching related colleges
        fetchCollegesData(pendingDispatchData);
      } else {
        console.log('Error fetching dispatch data: ', response);
      }
    } catch (error) {
      toast.error('Error fetching dispatch data');
      console.error('Error fetching dispatch data', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCollegesData = async (dispatchData) => {
    console.log('Fetching colleges data...');
    setLoadingColleges(true);
    try {
      const collegeIds = dispatchData.map(item => item.college);
      const uniqueCollegeIds = [...new Set(collegeIds)];
      let allCollegesData = [];

      for (let i = 0; i < uniqueCollegeIds.length; i += 5) { // Fetch 5 colleges in parallel
        const batchIds = uniqueCollegeIds.slice(i, i + 5);
        const promises = batchIds.map(id => {
          if (collegeCache[id]) {
            console.log(`Fetching college from cache: ${id}`);
            return Promise.resolve({ data: collegeCache[id] });
          } else {
            console.log(`Fetching college from API: ${id}`);
            return axios.get(`${BASE_URL}${ENDPOINT_GET_COLLEGES}/${id}`, { headers: HEADERS });
          }
        });

        const responses = await Promise.all(promises);
        for (const response of responses) {
          if (response.status === 200) {
            allCollegesData.push(response.data);
            setCollegeCache(prevCache => ({ ...prevCache, [response.data.id]: response.data }));
          }
        }

        if (i + 5 < uniqueCollegeIds.length) {
          await delay(2000); // Delay for 2 seconds after every batch of requests
        }
      }
      const collegesMap = {};
      allCollegesData.forEach(college => {
        collegesMap[college.id] = college;
      });
      setCollegesData(collegesMap);
      console.log('Colleges data:', collegesMap);
      toast.success('Colleges data fetched successfully');
    } catch (error) {
      toast.error('Error fetching colleges data');
      console.error('Error fetching colleges data', error);
    } finally {
      setLoadingColleges(false);
    }
  };

  const handleSearch = async () => {
    console.log('Search button clicked');
    if (selectedDate && routeCode) {
      setCurrentPage(1); // Reset to first page on new search
      await fetchDispatchData();
    } else {
      toast.error('Please enter both date and route code');
    }
  };

  const handlePickUp = (record) => {
    console.log('Pickup button clicked', record);
    setCurrentRecord(record);
    setShowModal(true);
  };

  const handleUpdateStatus = async () => {
    console.log('Updating dispatch status...');
    try {
      const response = await axios.patch(`${BASE_URL}${ENDPOINT_UPDATE_DISPATCH}/${currentRecord.id}`, {
        status: 'complete',
        name,
      }, { headers: HEADERS });
      if (response.status === 200) {
        handleSearch(); // Refresh data after updating status
        setShowModal(false);
        setName('');
        setCurrentRecord(null);
        toast.success('Dispatch status updated successfully');
      }
    } catch (error) {
      toast.error('Error updating dispatch status');
      console.error('Error updating dispatch status', error);
    }
  };

  const filteredData = dispatchData.filter(item => {
    const examDate = new Date(item.exam_date).toISOString().split('T')[0];
    const college = collegesData[item.college];
    const matchesRouteCode = college?.route_code === parseInt(routeCode, 10); // Ensure route code is compared as a number
    console.log(`Filtering record: ${item.id}, Exam Date: ${examDate}, College Route Code: ${college?.route_code}, Matches Route Code: ${matchesRouteCode}`);
    return examDate === formatDateForAPI(selectedDate) && matchesRouteCode;
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto flex flex-col items-center p-4">
        <ToastContainer />
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4 items-center mb-4">
          <DatePicker
            selected={selectedDate}
            onChange={(date) => setSelectedDate(date)}
            dateFormat="yyyy-MM-dd"
            placeholderText="Select a date"
            className="border p-2 rounded text-center w-full md:w-auto"
          />
          <input
            type="number"
            className="border p-2 rounded text-center w-full md:w-auto"
            value={routeCode}
            onChange={(e) => setRouteCode(e.target.value)}
            placeholder="Enter Route Code"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-500 text-white p-2 rounded flex justify-center items-center text-center w-full mx-auto md:w-auto"
          >
            <FaSearch className="mr-2" /> Search
          </button>
        </div>
        {loading || loadingColleges ? (
          <div className="flex flex-col items-center">
            <Slab color="#32cd32" size="medium" text="" textColor="" />
            <p className="mt-2">Loading...</p>
          </div>
        ) : (
          <>
            {filteredData.length === 0 ? (
              <div className="text-center text-gray-500">No data present. Please select an appropriate date and route code.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredData.map(record => (
                  <div key={record.id} className="bg-white p-4 rounded-lg shadow-md">
                    <h2 className="text-lg font-semibold mb-2">{collegesData[record.college]?.college_name}</h2>
                    <p><strong>College Code:</strong> {collegesData[record.college]?.college_id}</p>
                    <p><strong>Route Code:</strong> {collegesData[record.college]?.route_code}</p>
                    <p><strong>Route Name:</strong> {collegesData[record.college]?.route_name}</p>
                    <p><strong>Exam Date:</strong> {record.exam_date}</p>
                    <button
                      className="mt-4 bg-blue-500 text-white py-1 px-3 rounded"
                      onClick={() => handlePickUp(record)}
                    >
                      Pickedup
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={() => setCurrentPage(prevPage => Math.max(prevPage - 1, 1))}
                disabled={currentPage === 1}
                className="bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(prevPage => (prevPage < totalPages ? prevPage + 1 : prevPage))}
                disabled={currentPage === totalPages}
                className="bg-blue-500 text-white py-2 px-4 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
        {showModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Pickedup
                      </h3>
                      <div className="mt-2">
                        <input
                          type="text"
                          className="border p-2 w-full rounded"
                          placeholder="Enter your name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-500 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleUpdateStatus}
                  >
                    Submit
                  </button>
                  <button
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
